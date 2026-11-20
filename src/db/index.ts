import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

type Db = MySql2Database<typeof schema>;
const g = globalThis as unknown as { __tjPool?: mysql.Pool; __tjDb?: Db };

/** Single small pool, reused across hot reloads (shared hosting has tight connection limits). */
export const pool: mysql.Pool =
  g.__tjPool ??
  mysql.createPool({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    database: env.DATABASE_NAME,
    connectionLimit: env.DATABASE_POOL_SIZE,
    maxIdle: 2,
    idleTimeout: 60_000,
    waitForConnections: true,
    enableKeepAlive: true,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    dateStrings: false,
  });

export const db: Db = g.__tjDb ?? drizzle(pool, { schema, mode: "default" });
g.__tjPool = pool;
g.__tjDb = db;

export { schema };

export async function dbHealth(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const [rows] = await pool.query("SELECT VERSION() AS v");
    return { ok: true, version: (rows as Array<{ v: string }>)[0]?.v };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
