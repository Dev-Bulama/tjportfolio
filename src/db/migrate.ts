import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { db, pool } from "./index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { fromRoot } from "../config/paths.js";

export const migrationsFolder = fromRoot("drizzle");
const LOCK = "tj_portfolio_migrations";

/**
 * Applies pending migrations. Guarded by a MySQL advisory lock so two cold starts
 * racing each other never run the same migration twice. Idempotent and fast when up to date.
 */
export async function runMigrations(): Promise<{ applied: boolean; ms: number }> {
  const started = Date.now();
  const conn = await pool.getConnection();
  try {
    try {
      await conn.query(
        `ALTER DATABASE \`${env.DATABASE_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    } catch {
      // Not fatal: shared hosts sometimes deny ALTER DATABASE. Tables still default to utf8mb4.
    }
    const [rows] = await conn.query("SELECT GET_LOCK(?, 30) AS got", [LOCK]);
    if ((rows as Array<{ got: number }>)[0]?.got !== 1) throw new Error("Could not acquire migration lock");
    try {
      await migrate(db, { migrationsFolder });
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
