import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

export type SqliteConn = DB;

let _db: DB | null = null;

export const getDb = (path: string) => {
  if (_db) return _db;
  _db = new DB(path);
  // Pragmas (tolerar falhas em ambientes que não suportam alguns modos)
  try { _db.execute("PRAGMA foreign_keys=ON;"); } catch (_) {}
  // Forçar DELETE journal para compatibilidade ampla
  try { _db.execute("PRAGMA journal_mode=DELETE;"); } catch (_) {}
  try { _db.execute("PRAGMA synchronous=NORMAL;"); } catch (_) {}
  return _db;
};

export const closeDb = () => {
  if (_db) {
    _db.close();
    _db = null;
  }
};
