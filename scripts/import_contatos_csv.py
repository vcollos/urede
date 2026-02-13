#!/usr/bin/env python3
"""
Importa contatos de cooperativas a partir de um CSV (UTF-8) para o SQLite.

Regras:
- id_singular: sempre 3 dígitos (string "001")
- Deduplicação por (id_singular, tipo, valor) antes de inserir
- Para Email e Website: valida e normaliza valor
  - Email: lower-case e trim
  - Website: garante http/https, remove fragment, normaliza host e remove "/" final
- Ignora coluna ativo (sempre ativo=1)
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import shutil
import sqlite3
import sys
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, urlunparse


EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def normalize_enum_text(value: str) -> str:
    s = (value or "").strip().lower()
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return s


def normalize_id_singular(value: str) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return None
    if len(digits) > 3:
        return None
    return digits.zfill(3)


def normalize_tipo(value: str) -> str:
    t = normalize_enum_text(value)
    if t in ("e-mail", "email", "mail"):
        return "email"
    if "whats" in t:
        return "whatsapp"
    if t in ("telefone", "tel") or "telefone" in t:
        return "telefone"
    if t in ("website", "site", "web"):
        return "website"
    if t in ("outro", "outros"):
        return "outro"
    return t


def normalize_subtipo(value: str) -> str:
    s = normalize_enum_text(value)
    s = re.sub(r"\s+", " ", s).strip()
    if s in ("plantao", "plantao24h", "plantao_24h"):
        return "plantao"
    if s == "emergencia":
        return "emergencia"
    if s == "divulgacao":
        return "divulgacao"
    if s == "lgpd":
        return "lgpd"
    if s == "comercial pf":
        return "comercial pf"
    if s == "comercial pj":
        return "comercial pj"
    if s == "institucional":
        return "institucional"
    if s in (
        "portal do prestador",
        "portal do cliente",
        "portal da empresa",
        "portal do corretor",
        "portal do cooperado",
    ):
        return s
    if s in ("e-commerce", "ecommerce"):
        return "e-commerce"
    return s


def normalize_email(value: str) -> Optional[str]:
    v = (value or "").strip().lower()
    return v or None


def is_valid_email(value: str) -> bool:
    v = (value or "").strip()
    if not v or len(v) > 254:
        return False
    return bool(EMAIL_RE.match(v))


def normalize_website(value: str) -> Optional[str]:
    raw = (value or "").strip()
    if not raw:
        return None
    if not re.match(r"^https?://", raw, flags=re.I):
        raw = "https://" + raw
    u = urlparse(raw)
    if u.scheme.lower() not in ("http", "https"):
        return None
    if not u.netloc:
        return None
    # Remove fragment; normalize host and strip trailing slash (non-root)
    scheme = u.scheme.lower()
    netloc = u.netloc.lower()
    path = u.path or ""
    if len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    normalized = urlunparse((scheme, netloc, path, "", u.query or "", ""))
    return normalized


def parse_principal(value: str) -> int:
    v = (value or "").strip().lower()
    if v in ("1", "true", "sim", "s", "y", "yes", "x"):
        return 1
    return 0


@dataclass(frozen=True)
class NormalizedContato:
    id_singular: str
    tipo: str
    subtipo: Optional[str]
    valor: Optional[str]
    principal: int

    def key(self) -> str:
        return f"{self.id_singular}|{self.tipo}|{self.valor or ''}"


def backup_db(db_path: str, backups_dir: str) -> str:
    os.makedirs(backups_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = os.path.join(backups_dir, f"{os.path.basename(db_path)}.{ts}.bak")
    shutil.copy2(db_path, dst)
    return dst


def dedupe_existing(conn: sqlite3.Connection) -> int:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, id_singular, tipo, valor, COALESCE(principal,0) AS principal, COALESCE(criado_em,'') AS criado_em
          FROM urede_cooperativa_contatos
        """
    )
    rows = cur.fetchall()
    groups: Dict[str, List[Tuple[str, int, str]]] = {}
    for (rid, id_singular, tipo, valor, principal, criado_em) in rows:
        nid = normalize_id_singular(str(id_singular or "")) or str(id_singular or "").strip()
        ntipo = normalize_tipo(str(tipo or ""))
        nvalor = (str(valor or "")).strip()
        if ntipo == "email":
            nvalor = normalize_email(nvalor) or ""
        elif ntipo == "website":
            nvalor = normalize_website(nvalor) or ""
        if not nid or not ntipo or not nvalor:
            continue
        key = f"{nid}|{ntipo}|{nvalor}"
        groups.setdefault(key, []).append((str(rid), int(principal or 0), str(criado_em or "")))

    deleted = 0
    for key, items in groups.items():
        if len(items) <= 1:
            continue
        # Keep: principal desc, criado_em desc, id asc
        items_sorted = sorted(
            items,
            key=lambda x: (-x[1], x[2], x[0]),
            reverse=True,
        )
        keep_id = items_sorted[0][0]
        delete_ids = [rid for (rid, _, _) in items_sorted[1:]]
        if delete_ids:
            cur.execute(
                f"DELETE FROM urede_cooperativa_contatos WHERE id IN ({','.join(['?']*len(delete_ids))})",
                delete_ids,
            )
            deleted += len(delete_ids)
        # Ensure keep principal if any had principal=1
        if any(p == 1 for (_, p, _) in items) and items_sorted[0][1] != 1:
            cur.execute(
                "UPDATE urede_cooperativa_contatos SET principal = 1 WHERE id = ?",
                (keep_id,),
            )
    return deleted


def contato_exists(conn: sqlite3.Connection, c: NormalizedContato) -> bool:
    cur = conn.cursor()
    cur.execute(
        """
        SELECT 1
          FROM urede_cooperativa_contatos
         WHERE id_singular = ?
           AND tipo = ?
           AND valor = ?
         LIMIT 1
        """,
        (c.id_singular, c.tipo, c.valor),
    )
    return cur.fetchone() is not None


def insert_contato(conn: sqlite3.Connection, c: NormalizedContato) -> None:
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO urede_cooperativa_contatos
          (id, id_singular, tipo, subtipo, valor, principal, ativo, label)
        VALUES
          (?,?,?,?,?,?,1,NULL)
        """,
        (str(uuid.uuid4()), c.id_singular, c.tipo, c.subtipo, c.valor, c.principal),
    )


def read_and_normalize_csv(path: str) -> Tuple[List[NormalizedContato], List[Dict[str, str]]]:
    normalized: List[NormalizedContato] = []
    invalid: List[Dict[str, str]] = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=2):  # header line = 1
            raw_id = (row.get("id_singular") or "").strip()
            id_singular = normalize_id_singular(raw_id)
            raw_tipo = row.get("tipo") or ""
            raw_subtipo = row.get("subtipo") or ""
            raw_valor = row.get("valor") or ""
            principal = parse_principal(row.get("principal") or "")

            if not id_singular:
                invalid.append({"line": str(idx), "reason": "id_singular inválido (precisa 3 dígitos).", "row": str(row)})
                continue

            tipo = normalize_tipo(raw_tipo)
            subtipo = normalize_subtipo(raw_subtipo) if raw_subtipo.strip() else None
            valor: Optional[str] = raw_valor.strip() if raw_valor is not None else None
            if tipo == "email":
                valor = normalize_email(valor or "")
                if not valor or not is_valid_email(valor):
                    invalid.append({"line": str(idx), "reason": "Email inválido em valor.", "id_singular": id_singular, "valor": raw_valor})
                    continue
            elif tipo == "website":
                valor = normalize_website(valor or "")
                if not valor:
                    invalid.append({"line": str(idx), "reason": "URL inválida em valor (use http/https).", "id_singular": id_singular, "valor": raw_valor})
                    continue

            normalized.append(NormalizedContato(id_singular=id_singular, tipo=tipo, subtipo=subtipo, valor=valor, principal=principal))

    return normalized, invalid


def get_existing_cooperativas(conn: sqlite3.Connection) -> set[str]:
    cur = conn.cursor()
    cur.execute("SELECT id_singular FROM urede_cooperativas")
    out: set[str] = set()
    for (id_singular,) in cur.fetchall():
        nid = normalize_id_singular(str(id_singular or ""))
        if nid:
            out.add(nid)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True, help="Caminho do SQLite DB (ex.: data/urede.db.nwal)")
    ap.add_argument("--csv", required=True, help="Caminho do CSV de contatos")
    ap.add_argument("--backups-dir", default="data/backups", help="Pasta de backups")
    args = ap.parse_args()

    if not os.path.exists(args.db):
        print(f"DB não encontrado: {args.db}", file=sys.stderr)
        return 2
    if not os.path.exists(args.csv):
        print(f"CSV não encontrado: {args.csv}", file=sys.stderr)
        return 2

    backup_path = backup_db(args.db, args.backups_dir)
    print(f"[backup] {backup_path}")

    conn = sqlite3.connect(args.db, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        existing_ids = get_existing_cooperativas(conn)
        contatos, invalid = read_and_normalize_csv(args.csv)
        print(f"[csv] linhas normalizadas: {len(contatos)}")
        if invalid:
            print(f"[csv] linhas inválidas (ignoradas): {len(invalid)}")
            for it in invalid[:25]:
                print(f"  - linha {it.get('line')}: {it.get('reason')} ({it.get('id_singular','')}) {it.get('valor','')}")
            if len(invalid) > 25:
                print("  - ...")

        conn.execute("BEGIN IMMEDIATE")
        deleted = dedupe_existing(conn)
        if deleted:
            print(f"[dedupe] removidos duplicados existentes: {deleted}")

        seen: set[str] = set()
        inserted = 0
        skipped_existing = 0
        skipped_dup_in_file = 0
        skipped_missing_coop = 0
        for c in contatos:
            if c.id_singular not in existing_ids:
                skipped_missing_coop += 1
                continue
            k = c.key()
            if k in seen:
                skipped_dup_in_file += 1
                continue
            seen.add(k)
            if c.valor is None or not c.valor.strip():
                continue
            if contato_exists(conn, c):
                skipped_existing += 1
                continue
            insert_contato(conn, c)
            inserted += 1

        conn.commit()
        print(f"[import] inseridos: {inserted}")
        print(f"[import] ignorados (já existiam): {skipped_existing}")
        print(f"[import] ignorados (duplicados no arquivo): {skipped_dup_in_file}")
        print(f"[import] ignorados (id_singular não existe em cooperativas): {skipped_missing_coop}")
    except Exception as e:
        conn.rollback()
        print(f"[erro] import falhou, rollback executado: {e}", file=sys.stderr)
        return 1
    finally:
        conn.close()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
