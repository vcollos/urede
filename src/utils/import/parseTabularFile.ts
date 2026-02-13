import { read, utils } from 'xlsx';

const normalizeHeader = (value: unknown) => {
  // Keep ASCII-only keys to match backend columns (snake_case).
  const raw = (value ?? '').toString().trim();
  if (!raw) return '';
  return raw
    .replace(/^\uFEFF/, '') // BOM
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
};

const detectDelimiter = (text: string) => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10);
  const candidates = [',', ';', '\t'] as const;
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    const score = lines.reduce((acc, line) => acc + (line.split(d).length - 1), 0);
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
};

const parseCsv = (text: string) => {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Normalize newlines and strip trailing null chars.
  const s = text.replace(/\0/g, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const next = s[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      field += ch;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = '';
      continue;
    }

    if (ch === '\n' || ch === '\r') {
      // Handle CRLF
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      // ignore empty trailing row
      if (row.some((c) => (c ?? '').toString().trim().length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  // last field
  row.push(field);
  if (row.some((c) => (c ?? '').toString().trim().length > 0)) rows.push(row);

  if (!rows.length) return [] as Record<string, unknown>[];

  const headersRaw = rows[0] || [];
  const headers = headersRaw.map((h) => normalizeHeader(h)).filter(Boolean);
  const headerIndex = headersRaw.map((h) => normalizeHeader(h));

  const out: Record<string, unknown>[] = [];
  for (const r of rows.slice(1)) {
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < r.length; j++) {
      const key = headerIndex[j];
      if (!key) continue;
      obj[key] = r[j];
    }
    // ignore fully empty rows
    if (Object.values(obj).some((v) => (v ?? '').toString().trim().length > 0)) {
      out.push(obj);
    }
  }

  return out;
};

export const parseTabularFile = async (file: File): Promise<Record<string, unknown>[]> => {
  const name = (file.name || '').toLowerCase();

  // CSV: use File.text() which decodes as UTF-8 in the browser (fixes "JOSÃ‰" issues).
  if (name.endsWith('.csv') || name.endsWith('.tsv')) {
    const text = await file.text();
    return parseCsv(text);
  }

  // XLS/XLSX: parse via xlsx.
  const buf = await file.arrayBuffer();
  const wb = read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const rows = utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
  if (!Array.isArray(rows)) return [];

  // normalize headers
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      const nk = normalizeHeader(k);
      if (!nk) continue;
      out[nk] = v;
    }
    return out;
  });
};

