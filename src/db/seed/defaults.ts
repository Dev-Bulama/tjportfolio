import { asc, gt, sql } from "drizzle-orm";
import { db } from "../index.js";
import { homepageSections } from "../schema/index.js";
import { homepageSections as DEFAULTS } from "./data-profile.js";
import { bust } from "../../lib/cache.js";
import { logger } from "../../lib/logger.js";

/**
 * Adds homepage sections introduced by newer versions of the site to an existing install,
 * placing each right after the section that precedes it in the defaults. Never changes or
 * re-adds sections the owner already has (or hid). No-op on a site that hasn't been seeded.
 */
export async function ensureHomepageSections(): Promise<number> {
  const existing = await db.select().from(homepageSections).orderBy(asc(homepageSections.sortOrder));
  if (!existing.length) return 0;
  const keys = new Set(existing.map((s) => s.key));
  let added = 0;
  for (const [i, def] of DEFAULTS.entries()) {
    if (keys.has(def.key)) continue;
    const prevKey = DEFAULTS.slice(0, i).reverse().find((d) => keys.has(d.key))?.key;
    const prev = existing.find((s) => s.key === prevKey);
    const order = prev ? prev.sortOrder + 1 : 0;
    await db.update(homepageSections).set({ sortOrder: sql`${homepageSections.sortOrder} + 1` }).where(gt(homepageSections.sortOrder, order - 1));
    await db.insert(homepageSections).ignore().values({ ...def, status: "published", sortOrder: order });
    keys.add(def.key);
    existing.push({ ...existing[0]!, key: def.key, sortOrder: order });
    for (const s of existing) if (s.key !== def.key && s.sortOrder >= order) s.sortOrder += 1;
    added++;
  }
  if (added) {
    bust("homepage");
    logger.info({ added }, "added new default homepage sections");
  }
  return added;
}
