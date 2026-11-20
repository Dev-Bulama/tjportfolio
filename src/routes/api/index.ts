import { Router } from "express";
import { and, eq, lt, lte, sql } from "drizzle-orm";
import { db, dbHealth } from "../../db/index.js";
import * as s from "../../db/schema/index.js";
import { env } from "../../config/env.js";
import { storageHealth, checkStorage } from "../../lib/storage/index.js";
import { safeEqual } from "../../lib/crypto.js";
import { rateLimit, pruneRateLimits } from "../../lib/rate-limit.js";
import { runJobs, notifyAdmin } from "../../lib/jobs.js";
import { T } from "../../lib/mail/templates.js";
import { bust } from "../../lib/cache.js";
import { logger } from "../../lib/logger.js";
import { purgeExpiredSessions } from "../../lib/auth/session.js";
import { EVENT_NAMES, pruneAnalytics, recordHit, rollup, trackEvent } from "../../server/analytics.js";
import { getSettings } from "../../server/settings.js";
import { purgeTrash } from "../../server/maintenance.js";
import { createBackup } from "../../server/backup.js";
import { bootStatus } from "../../server/boot.js";
import { fromRoot } from "../../config/paths.js";
import { existsSync } from "node:fs";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  const db1 = await dbHealth();
  const storage = storageHealth();
  res.setHeader("Cache-Control", "no-store");
  res.status(db1.ok ? 200 : 503).json({
    ok: db1.ok,
    db: db1.ok ? "up" : "down",
    dbVersion: db1.version,
    ...(db1.ok ? {} : { dbError: db1.error }),
    storage: storage ? { driver: storage.driver, ok: storage.ok, ...(storage.ok ? {} : { detail: storage.detail }) } : undefined,
    migrations: bootStatus.migrations,
    ...(bootStatus.migrationError ? { migrationError: bootStatus.migrationError } : {}),
    files: { views: existsSync(fromRoot("views", "layouts", "site.ejs")), css: existsSync(fromRoot("public", "assets", "app.css")), js: existsSync(fromRoot("public", "assets", "site.js")) },
    uptime: Math.round(process.uptime()),
    node: process.version,
  });
});

/** Analytics beacon (brief §4.10). Cookieless; rate-limited per IP hash. */
apiRouter.post("/collect", async (req, res) => {
  res.status(204).setHeader("Cache-Control", "no-store");
  try {
    const lim = await rateLimit("collect", req.ipHashed, 120, 60);
    if (!lim.ok) return void res.end();
    const b = (typeof req.body === "object" && req.body) || {};
    if (b.t === "pageview" && typeof b.path === "string") {
      await recordHit(req, { path: b.path.slice(0, 255), ref: typeof b.ref === "string" ? b.ref.slice(0, 500) : undefined, q: typeof b.q === "string" ? b.q.slice(0, 500) : undefined });
    } else if (b.t === "event" && typeof b.name === "string" && (EVENT_NAMES as readonly string[]).includes(b.name)) {
      await trackEvent(req, b.name, typeof b.label === "string" ? b.label : null, typeof b.path === "string" ? b.path : undefined);
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "collect failed");
  }
  res.end();
});

/**
 * Scheduled work (brief §12.6): GET /api/cron?secret=…&task=all
 * Tasks: rollup, prune, trash, emails, publish, certs, backup.
 */
apiRouter.get("/cron", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const secret = String(req.query.secret ?? req.get("x-cron-secret") ?? "");
  if (!env.CRON_SECRET || !safeEqual(secret, env.CRON_SECRET)) return void res.status(401).json({ ok: false, error: "Unauthorized" });
  const task = String(req.query.task ?? "all");
  const want = (t: string) => task === "all" || task.split(",").includes(t);
  const out: Record<string, unknown> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    if (!want(name)) return;
    try {
      out[name] = (await fn()) ?? "ok";
    } catch (e) {
      out[name] = { error: (e as Error).message };
      logger.error({ err: (e as Error).message, task: name }, "cron task failed");
    }
  };
  const settings = await getSettings();
  await run("emails", () => runJobs(50));
  await run("publish", async () => {
    let n = 0;
    for (const t of [s.posts, s.projects, s.trainings, s.services, s.courses, s.pages, s.certifications, s.albums]) {
      const [r] = await db.update(t).set({ status: "published" }).where(and(eq(t.status, "scheduled"), lte(t.publishedAt, sql`NOW()`)));
      n += r.affectedRows;
    }
    if (n) bust("all");
    return { published: n };
  });
  await run("rollup", () => rollup(3).then((rows) => ({ rows })));
  await run("prune", async () => {
    await pruneAnalytics(settings.site.analyticsRetentionDays);
    await pruneRateLimits();
    await purgeExpiredSessions();
    await db.delete(s.jobs).where(and(eq(s.jobs.status, "done"), lt(s.jobs.updatedAt, new Date(Date.now() - 30 * 864e5))));
    await db.delete(s.loginAttempts).where(lt(s.loginAttempts.createdAt, new Date(Date.now() - 90 * 864e5)));
    await db.delete(s.passwordResets).where(lt(s.passwordResets.expiresAt, new Date(Date.now() - 864e5)));
    await checkStorage();
    return "ok";
  });
  await run("trash", () => purgeTrash(settings.site.trashRetentionDays));
  await run("certs", async () => {
    const soon = await db
      .select({ name: s.certifications.name, expiry: s.certifications.expiryDate })
      .from(s.certifications)
      .where(and(eq(s.certifications.isSample, false), sql`${s.certifications.deletedAt} is null`, sql`${s.certifications.expiryDate} = DATE_ADD(CURDATE(), INTERVAL 30 DAY)`));
    if (soon.length) await notifyAdmin(T.adminNotice("Certifications expiring in 30 days", soon.map((c) => `${c.name} expires on ${c.expiry}.`)));
    return { reminders: soon.length };
  });
  if (req.query.backup === "1" || task.split(",").includes("backup")) await run("backup", () => createBackup({ target: "auto" }));
  res.json({ ok: true, task, ran: out, at: new Date().toISOString() });
});
