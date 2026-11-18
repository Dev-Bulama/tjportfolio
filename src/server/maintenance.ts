import { and, eq, isNotNull, lt } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "../db/index.js";
import { media } from "../db/schema/index.js";
import { RESOURCES } from "../resources/registry.js";
import { destroyRecords } from "../resources/engine.js";
import { deleteFiles } from "./upload.js";
import { bust } from "../lib/cache.js";


/** Permanently deletes anything that has been in the trash longer than the retention period (default 30 days). */
export async function purgeTrash(days: number): Promise<Record<string, number>> {
  const cutoff = new Date(Date.now() - days * 864e5);
  const out: Record<string, number> = {};
  for (const def of Object.values(RESOURCES)) {
    if (!def.trash) continue;
    const c = getTableColumns(def.table) as unknown as Record<string, MySqlColumn>;
    if (!c.deletedAt) continue;
    const rows = (await db.select({ id: c.id! }).from(def.table).where(and(isNotNull(c.deletedAt), lt(c.deletedAt, cutoff)))) as Array<{ id: number }>;
    if (rows.length) {
      await destroyRecords(def, rows.map((r) => r.id), { id: 0, name: "system (trash auto-purge)" });
      out[def.key] = rows.length;
    }
  }
  const files = await db.select().from(media).where(and(isNotNull(media.deletedAt), lt(media.deletedAt, cutoff)));
  for (const m of files) {
    await db.delete(media).where(eq(media.id, m.id));
    await deleteFiles(m);
  }
  if (files.length) out.media = files.length;
  bust("all");
  return out;
}
