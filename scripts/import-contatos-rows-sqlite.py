#!/usr/bin/env python3
import argparse
import csv
import datetime as dt
import os
import re
import shutil
import sqlite3
import sys
from urllib.parse import urlparse, urlunparse


EMAIL_RE = re.compile(r"^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$", re.IGNORECASE)


def normalize_id_singular(value: str) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    digits = re.sub(r"\D+", "", raw)
    if not digits or len(digits) > 3:
        return None
    return digits.zfill(3)


def strip_accents(s: str) -> str:
    # Minimal accent folding for our known values (pt-BR).
    return (
        s.replace("ã", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
        .replace("ç", "c")
    )


def normalize_enum_text(value: str) -> str:
    s = (value or "").strip().lower()
    s = strip_accents(s)
    s = re.sub(r"\s+", " ", s)
    return s


def normalize_tipo(value: str) -> str | None:
    s = normalize_enum_text(value)
    if not s:
        return None
    if s in ("e-mail", "email", "mail"):
        return "email"
    if "whats" in s:
        return "whatsapp"
    if s.startswith("telefone") or s == "tel":
        return "telefone"
    if s in ("website", "site", "web"):
        return "website"
    if s in ("outro", "outros"):
        return "outro"
    # Accept already-canonical unknowns as-is (portal may evolve).
    return s


def normalize_subtipo(value: str) -> str | None:
    s = normalize_enum_text(value)
    if not s:
        return None
    if s == "plantao" or s == "plantao 24h" or s == "plantao24h":
        return "plantao"
    if s == "emergencia":
        return "emergencia"
    if s == "divulgacao":
        return "divulgacao"
    if s == "lgpd":
        return "lgpd"
    if s == "comercial pf" or s == "comercial_pf" or s == "comercial-pf":
        return "comercial pf"
    if s == "comercial pj" or s == "comercial_pj" or s == "comercial-pj":
        return "comercial pj"
    if s == "institucional":
        return "institucional"
    if s == "portal do prestador":
        return "portal do prestador"
    if s == "portal do cliente":
        return "portal do cliente"
    if s == "portal da empresa":
        return "portal da empresa"
    if s == "portal do corretor":
        return "portal do corretor"
    if s in ("e-commerce", "ecommerce"):
        return "e-commerce"
    if s == "portal do cooperado":
        return "portal do cooperado"
    # Accept unknowns as-is.
    return s


def normalize_email(value: str) -> str | None:
    s = (value or "").strip().lower()
    return s or None


def normalize_url(value: str) -> str | None:
    raw = (value or "").strip()
    if not raw:
        return None
    # Add scheme if missing.
    candidate = raw
    if not re.match(r"^https?://", candidate, re.IGNORECASE):
        candidate = "https://" + candidate
    p = urlparse(candidate)
    if p.scheme.lower() not in ("http", "https"):
        return None
    if not p.netloc:
        return None
    scheme = p.scheme.lower()
    netloc = p.netloc.lower()
    path = p.path or ""
    # Canonicalize: drop trailing slash for root.
    if path == "/":
        path = ""
    return urlunparse((scheme, netloc, path, "", p.query or "", ""))


def parse_bool01(value: str) -> int:
    s = (value or "").strip().lower()
    return 1 if s in ("1", "true", "t", "yes", "y", "sim") else 0


def backup_db(db_path: str, backups_dir: str) -> str:
    os.makedirs(backups_dir, exist_ok=True)
    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    dst = os.path.join(backups_dir, f"{os.path.basename(db_path)}.{ts}.contatos_import.bak")
    shutil.copy2(db_path, dst)
    return dst


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="data/urede.db.nwal")
    ap.add_argument("--csv", required=True)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    csv_path = args.csv
    db_path = args.db

    if not os.path.exists(csv_path):
        print(f"[import-contatos] CSV não encontrado: {csv_path}", file=sys.stderr)
        return 2
    if not os.path.exists(db_path):
        print(f"[import-contatos] DB não encontrado: {db_path}", file=sys.stderr)
        return 2

    rows: list[dict] = []
    errors: list[str] = []

    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=",")
        required_cols = {"id_singular", "tipo", "subtipo", "valor"}
        if not required_cols.issubset(set(reader.fieldnames or [])):
            missing = sorted(required_cols - set(reader.fieldnames or []))
            print(f"[import-contatos] CSV sem colunas obrigatórias: {', '.join(missing)}", file=sys.stderr)
            return 2

        for idx, r in enumerate(reader, start=2):
            id_singular = normalize_id_singular(r.get("id_singular", ""))
            if not id_singular:
                errors.append(f"linha {idx}: id_singular inválido: {r.get('id_singular')!r}")
                continue

            tipo = normalize_tipo(r.get("tipo", ""))
            if not tipo:
                errors.append(f"linha {idx}: tipo vazio/inválido")
                continue

            subtipo = normalize_subtipo(r.get("subtipo", ""))
            if not subtipo:
                errors.append(f"linha {idx}: subtipo vazio/inválido")
                continue

            valor_raw = r.get("valor", "")
            valor: str | None
            if tipo == "email":
                valor = normalize_email(valor_raw)
                if not valor or not EMAIL_RE.match(valor):
                    errors.append(f"linha {idx}: email inválido: {valor_raw!r}")
                    continue
            elif tipo == "website":
                valor = normalize_url(valor_raw)
                if not valor:
                    errors.append(f"linha {idx}: url inválida: {valor_raw!r}")
                    continue
            elif tipo in ("telefone", "whatsapp", "celular"):
                # Forçar somente dígitos.
                digits = re.sub(r"\D+", "", (valor_raw or "").strip())
                valor = digits or None
                if not valor:
                    errors.append(f"linha {idx}: telefone inválido (sem dígitos): {valor_raw!r}")
                    continue
            else:
                valor = (valor_raw or "").strip() or None
                if not valor:
                    errors.append(f"linha {idx}: valor vazio")
                    continue

            principal = parse_bool01(r.get("principal", "0"))
            label = (r.get("label", "") or "").strip() or None

            rows.append(
                {
                    "id_singular": id_singular,
                    "tipo": tipo,
                    "subtipo": subtipo,
                    "valor": valor,
                    "principal": principal,
                    "label": label,
                }
            )

    if errors:
        print("[import-contatos] Validação falhou; nada foi importado.", file=sys.stderr)
        for e in errors[:50]:
            print(" -", e, file=sys.stderr)
        if len(errors) > 50:
            print(f" - ... (+{len(errors)-50} erros)", file=sys.stderr)
        return 1

    # Dedupe inside CSV after normalization
    seen = set()
    deduped: list[dict] = []
    for r in rows:
        key = (r["id_singular"], r["tipo"], r["valor"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(r)

    if args.dry_run:
        print(f"[import-contatos] DRY RUN: {len(deduped)} linhas válidas após dedupe (de {len(rows)}).")
        return 0

    backup = backup_db(db_path, "data/backups")
    print(f"[import-contatos] Backup: {backup}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON;")

    # Ensure target table exists
    t = cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='urede_cooperativa_contatos' LIMIT 1"
    ).fetchone()
    if not t:
        print("[import-contatos] Tabela urede_cooperativa_contatos não existe no DB.", file=sys.stderr)
        conn.close()
        return 2

    # Remove duplicates already present (keep one row by rowid)
    cur.execute("BEGIN;")
    try:
        cur.execute(
            """
            DELETE FROM urede_cooperativa_contatos
            WHERE rowid NOT IN (
              SELECT MIN(rowid)
              FROM urede_cooperativa_contatos
              GROUP BY id_singular,
                       lower(trim(tipo)),
                       CASE WHEN lower(trim(tipo))='email' THEN lower(trim(valor)) ELSE trim(valor) END
            );
            """
        )

        # Insert non-existing
        inserted = 0
        skipped = 0
        for r in deduped:
            exists = cur.execute(
                """
                SELECT 1
                FROM urede_cooperativa_contatos
                WHERE id_singular = ?
                  AND lower(trim(tipo)) = ?
                  AND (
                    CASE WHEN lower(trim(tipo))='email' THEN lower(trim(valor)) ELSE trim(valor) END
                  ) = ?
                LIMIT 1;
                """,
                (r["id_singular"], r["tipo"], r["valor"]),
            ).fetchone()
            if exists:
                skipped += 1
                continue

            cur.execute(
                """
                INSERT INTO urede_cooperativa_contatos
                  (id_singular, tipo, subtipo, valor, principal, ativo, label)
                VALUES
                  (?, ?, ?, ?, ?, 1, ?);
                """,
                (r["id_singular"], r["tipo"], r["subtipo"], r["valor"], r["principal"], r["label"]),
            )
            inserted += 1

        conn.commit()
        print(f"[import-contatos] OK inserted={inserted} skipped={skipped} (csv_deduped={len(deduped)})")
    except Exception as e:
        conn.rollback()
        print("[import-contatos] ERRO, rollback executado:", str(e), file=sys.stderr)
        print(f"[import-contatos] Para desfazer totalmente: cp -f '{backup}' '{db_path}'", file=sys.stderr)
        conn.close()
        return 1

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

