import { SCHEMA_SQL } from "./schema";

/**
 * One small interface over two drivers:
 *   - DATABASE_URL set   → Postgres (Supabase) via `pg`
 *   - otherwise          → PGlite: real Postgres compiled to WASM, stored in .data/pglite
 *   - SELLAI_DB=memory   → PGlite in memory (tests and CLI demos; never touches your real data)
 * Same SQL everywhere, so what passes locally runs on Supabase.
 */

export interface Db {
  query<T = Record<string, any>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }>;
  exec(sql: string): Promise<void>;
  kind: "postgres" | "pglite-file" | "pglite-memory";
}

async function connect(): Promise<Db> {
  const forceMemory = process.env.SELLAI_DB === "memory";
  const url = process.env.DATABASE_URL;

  if (url && !forceMemory) {
    const { Pool } = (await import("pg")).default;
    const local = /localhost|127\.0\.0\.1/.test(url);
    const pool = new Pool({ connectionString: url, max: 5, ssl: local ? undefined : { rejectUnauthorized: false } });
    return {
      kind: "postgres",
      async query(sql, params) {
        const r = await pool.query(sql, params as unknown[]);
        return { rows: r.rows, rowCount: r.rowCount ?? 0 };
      },
      async exec(sql) {
        await pool.query(sql);
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = forceMemory ? undefined : process.env.PGLITE_DIR || ".data/pglite";
  if (dir) (await import("node:fs")).mkdirSync(dir, { recursive: true });
  const pg = dir ? new PGlite(dir) : new PGlite();
  return {
    kind: dir ? "pglite-file" : "pglite-memory",
    async query(sql, params) {
      const r = await pg.query(sql, params as unknown[]);
      return { rows: r.rows as never[], rowCount: r.affectedRows ?? r.rows.length };
    },
    async exec(sql) {
      await pg.exec(sql);
    },
  };
}

// One connection per process; survives Next.js hot reloads.
const g = globalThis as unknown as { __sellaiDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__sellaiDb) {
    g.__sellaiDb = (async () => {
      const d = await connect();
      await d.exec(SCHEMA_SQL);
      const { seedIfEmpty } = await import("./seed-db");
      await seedIfEmpty(d);
      return d;
    })().catch((e) => {
      g.__sellaiDb = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__sellaiDb;
}
