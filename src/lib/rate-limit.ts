import { sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { rateLimits } from "../db/schema/index.js";

export type Limit = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limiter stored in MySQL (no Redis on shared hosting).
 * Atomic upsert: resets the window when it has expired, otherwise increments.
 */
export async function rateLimit(bucket: string, id: string, max: number, windowSec: number): Promise<Limit> {
  const key = `${bucket}:${id}`.slice(0, 191);
  await db
    .insert(rateLimits)
    .values({ key, count: 1, resetAt: sql`DATE_ADD(NOW(), INTERVAL ${windowSec} SECOND)` })
    .onDuplicateKeyUpdate({
      set: {
        count: sql`IF(${rateLimits.resetAt} < NOW(), 1, ${rateLimits.count} + 1)`,
        resetAt: sql`IF(${rateLimits.resetAt} < NOW(), DATE_ADD(NOW(), INTERVAL ${windowSec} SECOND), ${rateLimits.resetAt})`,
      },
    });
  const row = (await db.select().from(rateLimits).where(sql`${rateLimits.key} = ${key}`))[0]!;
  return { ok: row.count <= max, remaining: Math.max(0, max - row.count), resetAt: row.resetAt };
}

export async function clearRateLimit(bucket: string, id: string): Promise<void> {
  await db.delete(rateLimits).where(sql`${rateLimits.key} = ${`${bucket}:${id}`.slice(0, 191)}`);
}

export async function pruneRateLimits(): Promise<void> {
  await db.delete(rateLimits).where(sql`${rateLimits.resetAt} < DATE_SUB(NOW(), INTERVAL 1 DAY)`);
}
