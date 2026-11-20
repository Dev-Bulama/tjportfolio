import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import type { PoolConnection } from "mysql2/promise";
import { db, pool } from "./index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { fromRoot } from "../config/paths.js";

export const migrationsFolder = fromRoot("drizzle");
const LOCK = "tj_portfolio_migrations";
const MIGRATIONS_TABLE = "__drizzle_migrations";
/**
 * Tables that only hold automatic, regenerable records (page views, rate-limit counters, sessions,
 * the email queue…). Rows in these never count as "real data" when recovering an interrupted first run.
 */
const DISPOSABLE = new Set(["analytics_hits", "analytics_events", "analytics_daily", "rate_limits", "jobs", "login_attempts", "sessions"]);

/** Table names created by our migrations (parsed from the SQL, so this never goes stale). */
function ourTables(): string[] {
  const names = new Set<string>();
  for (const f of fs.readdirSync(migrationsFolder).filter((n) => n.endsWith(".sql"))) {
    const sql = fs.readFileSync(path.join(migrationsFolder, f), "utf8");
    for (const m of sql.matchAll(/CREATE TABLE `([^`]+)`/g)) names.add(m[1]!);
  }
  return [...names];
}

/** Turns a Drizzle/mysql2 error into something readable: the database's own message comes first. */
export function describeDbError(e: unknown): string {
  const err = e as { message?: string; cause?: { message?: string; code?: string; sqlMessage?: string }; sqlMessage?: string; code?: string };
  const reason = err.cause?.sqlMessage ?? err.sqlMessage ?? err.cause?.message;
  const code = err.cause?.code ?? err.code;
  const query = (err.message ?? String(e)).replace(/\s+/g, " ").slice(0, 160);
  if (!reason) return (err.message ?? String(e)).slice(0, 500);
  return `${reason}${code ? ` (${code})` : ""} — while running: ${query}`;
}

/**
 * Recovers from an interrupted first migration: when no migration has ever been recorded but some of
 * our tables already exist, drop them — but only if every one of them is empty. Otherwise explain.
 */
async function recoverPartialInit(conn: PoolConnection): Promise<void> {
  const [tables] = await conn.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()");
  const existing = new Set((tables as Array<{ t: string }>).map((r) => r.t));
  if (existing.has(MIGRATIONS_TABLE)) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${MIGRATIONS_TABLE}\``);
    if (Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0) return; // normal case: already initialised
  }
  const leftovers = ourTables().filter((t) => existing.has(t));
  if (!leftovers.length) return;
  for (const t of leftovers.filter((x) => !DISPOSABLE.has(x))) {
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
    if (Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0) {
      throw new Error(
        `The database already contains table "${t}" with data, but no completed migration is recorded. ` +
          "Use an empty database for this site (or back it up and empty it), then restart the app.",
      );
    }
  }
  logger.warn({ tables: leftovers.length }, "removing tables left by an interrupted first migration (no content in them)");
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  try {
    for (const t of leftovers) await conn.query(`DROP TABLE IF EXISTS \`${t}\``);
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  }
}

/**
 * Applies pending migrations. Guarded by a database advisory lock so two cold starts racing each other
 * never run the same migration twice. Idempotent and fast when up to date. Works on MySQL 8 and MariaDB.
 */
export async function runMigrations(): Promise<{ applied: boolean; ms: number }> {
  const started = Date.now();
  const conn = await pool.getConnection();
  try {
    try {
      await conn.query(`ALTER DATABASE \`${env.DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch {
      // Not fatal: shared hosts sometimes deny ALTER DATABASE. Tables still default to utf8mb4.
    }
    const [rows] = await conn.query("SELECT GET_LOCK(?, 30) AS got", [LOCK]);
    if ((rows as Array<{ got: number }>)[0]?.got !== 1) throw new Error("Could not acquire migration lock");
    try {
      await recoverPartialInit(conn);
      await migrate(db, { migrationsFolder });
    } catch (e) {
      throw new Error(describeDbError(e), { cause: e });
    } finally {
      await conn.query("SELECT RELEASE_LOCK(?)", [LOCK]);
    }
  } finally {
    conn.release();
  }
  const ms = Date.now() - started;
  logger.info({ ms }, "migrations up to date");
  return { applied: true, ms };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runMigrations()
    .then(() => pool.end())
    .catch(async (e) => {
      console.error(e);
      await pool.end();
      process.exit(1);
    });
}
