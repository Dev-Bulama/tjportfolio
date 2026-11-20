import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { sql } from "drizzle-orm";
import { getTableName } from "drizzle-orm";
import type { MySqlTable } from "drizzle-orm/mysql-core";
import { db, pool } from "../db/index.js";
import * as s from "../db/schema/index.js";
import { media } from "../db/schema/index.js";
import { driver, s3Configured } from "../lib/storage/index.js";
import { uploadDir } from "../config/env.js";
import { bustAll } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

/**
 * Content tables in FK-safe insert order. Auth tables (users, sessions, codes) are deliberately
 * excluded so a restore can never lock the current owner out.
 */
const TABLES: MySqlTable[] = [
  s.settings, s.categories, s.tags, s.media, s.socialLinks, s.stats, s.homepageSections, s.skills, s.projects, s.projectImages,
  s.projectSkills, s.projectMetrics, s.experiences, s.education, s.trainings, s.trainingModules, s.trainingImages, s.courses,
  s.courseRegistrations, s.certifications, s.albums, s.mediaUsages, s.testimonials, s.reviewRequests, s.posts, s.taggables, s.services,
  s.serviceFaqs, s.clients, s.pressItems, s.faqs, s.pages, s.pageBlocks, s.menus, s.menuItems, s.messages, s.messageReplies,
  s.maintenanceTickets, s.ticketUpdates, s.ticketAttachments, s.subscribers, s.cvFiles, s.analyticsDaily,
];

export async function exportData(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const [rows] = await pool.query(`SELECT * FROM \`${getTableName(t)}\``);
    out[getTableName(t)] = rows as unknown[];
  }
  return out;
}

/** JSON of all content + every uploaded file, as one zip. */
export async function buildBackupZip(): Promise<Buffer> {
  const zip = new JSZip();
  const data = await exportData();
  zip.file("data.json", JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: data }));
  const files = await db.select({ key: media.key, driver: media.driver, variants: media.variants }).from(media);
  for (const f of files) {
    const keys = [f.key, ...(f.variants ?? []).map((v) => v.key)];
    for (const k of keys) {
      const buf = await driver(f.driver).getBuffer(k).catch(() => null);
      if (buf) zip.file(`uploads/${k}`, buf);
    }
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** Scheduled backup: to S3 when configured, otherwise into UPLOAD_DIR/backups (outside the web root). */
export async function createBackup(_o: { target: "auto" }): Promise<{ location: string; bytes: number }> {
  const buf = await buildBackupZip();
  const name = `backups/backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  if (s3Configured()) {
    await driver("s3").put(name, buf, "application/zip");
    return { location: `s3:${name}`, bytes: buf.length };
  }
  const p = path.join(uploadDir, name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buf);
  return { location: p, bytes: buf.length };
}

const DATE_COLS = /(_at|^ts)$/;

/** Restores a backup zip (content tables + files). Existing content is replaced; users are kept. */
export async function restoreBackup(buf: Buffer): Promise<{ tables: number; rows: number; files: number }> {
  const zip = await JSZip.loadAsync(buf);
  const raw = await zip.file("data.json")?.async("string");
  if (!raw) throw new Error("This zip doesn't contain data.json — is it a backup from this site?");
  const parsed = JSON.parse(raw) as { version?: number; tables?: Record<string, Array<Record<string, unknown>>> };
  if (parsed.version !== 1 || !parsed.tables) throw new Error("Unsupported backup format.");
  const known = new Set(TABLES.map((t) => getTableName(t)));
  let rows = 0;
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();
    for (const name of known) {
      const list = parsed.tables[name];
      if (!list) continue;
      await conn.query(`DELETE FROM \`${name}\``);
      for (const row of list) {
        const cols = Object.keys(row).filter((c) => /^[a-z_0-9]+$/.test(c));
        if (!cols.length) continue;
        const vals = cols.map((c) => {
          const v = row[c];
          if (v === null || v === undefined) return null;
          if (typeof v === "object") return JSON.stringify(v);
          if (typeof v === "string" && DATE_COLS.test(c) && /T.*Z$/.test(v)) return new Date(v);
          return v;
        });
        await conn.query(`INSERT INTO \`${name}\` (${cols.map((c) => `\`${c}\``).join(",")}) VALUES (${cols.map(() => "?").join(",")})`, vals);
        rows++;
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
    conn.release();
  }
  let files = 0;
  const d = driver();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.startsWith("uploads/")) continue;
    const key = entry.name.slice("uploads/".length);
    if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/i.test(key) || key.includes("..")) continue;
    await d.put(key, await entry.async("nodebuffer"), key.endsWith(".pdf") ? "application/pdf" : "application/octet-stream");
    files++;
  }
  // Uploaded rows keep their original driver; point them at the active one where files were restored.
  if (files) await db.update(media).set({ driver: d.name }).where(sql`1=1`);
  bustAll();
  logger.info({ rows, files }, "backup restored");
  return { tables: known.size, rows, files };
}
