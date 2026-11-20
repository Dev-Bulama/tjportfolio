import { Router } from "express";
import multer from "multer";
import { and, asc, desc, eq, gte, inArray, isNull, like, lt, ne, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as s from "../../db/schema/index.js";
import { adminUrl, env, smtpConfigured, turnstileConfigured, uploadDir } from "../../config/env.js";
import { checkCsrf } from "../../middleware/context.js";
import { getSettings, saveSetting } from "../../server/settings.js";
import { mediaMap } from "../../server/media.js";
import { sanitizePlain, sanitizeRich } from "../../lib/sanitize.js";
import { audit } from "../../lib/audit.js";
import { bust, bustAll, cacheSize } from "../../lib/cache.js";
import { hashPassword, passwordProblems } from "../../lib/auth/password.js";
import { destroyOtherSessions } from "../../lib/auth/session.js";
import { requestPasswordReset } from "../../server/auth.js";
import { runMigrations } from "../../db/migrate.js";
import { checkStorage, driver, s3Configured, storageHealth } from "../../lib/storage/index.js";
import { sharpStatus } from "../../server/upload.js";
import { mailer } from "../../lib/mail/transport.js";
import { renderEmail, T } from "../../lib/mail/templates.js";
import { runJobs } from "../../lib/jobs.js";
import { buildBackupZip, restoreBackup } from "../../server/backup.js";
import { rollup } from "../../server/analytics.js";
import { toCsv } from "../../lib/csv.js";
import { contrastRatio } from "../../lib/color.js";
import { ah, assertCan, flash } from "./mw.js";

export const siteAdminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024, files: 1 } });
const str = (v: unknown, max = 500) => sanitizePlain(String(v ?? "")).slice(0, max);
const num = (v: unknown) => (/^\d+$/.test(String(v ?? "")) ? Number(v) : null);

// ── Settings ──────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/settings", ah(async (req, res) => {
  assertCan(req, "view", "settings");
  const settings = await getSettings();
  const media = await mediaMap([settings.profile.portraitId, settings.branding.logoLightId, settings.branding.logoDarkId, settings.branding.faviconId, settings.seo.ogImageId, ...(settings.profile.secondaryPhotoIds ?? [])]);
  await res.page("admin/settings", {
    layout: "admin",
    title: "Site settings",
    s: settings,
    media,
    status: {
      smtp: smtpConfigured ? `${env.SMTP_HOST}:${env.SMTP_PORT} as ${env.SMTP_USER}` : null,
      turnstile: turnstileConfigured,
      storage: storageHealth(),
      s3: s3Configured(),
      driver: env.STORAGE_DRIVER,
      adminNotify: env.ADMIN_NOTIFY_EMAIL ?? env.SMTP_USER ?? null,
      cron: Boolean(env.CRON_SECRET),
    },
    readOnly: !res.locals.user || !["owner", "admin"].includes(req.user!.role),
  });
}));

siteAdminRouter.post("/settings/:section", ah(async (req, res) => {
  assertCan(req, "update", "settings");
  const b = req.body as Record<string, unknown>;
  const section = String(req.params.section);
  const before = await getSettings();
  switch (section) {
    case "profile": {
      const ids = (Array.isArray(b.secondaryPhotoIds) ? b.secondaryPhotoIds : String(b.secondaryPhotoIds ?? "").split(",")).map(num).filter((x): x is number => x !== null);
      await saveSetting("profile", {
        fullName: str(b.fullName, 191) || before.profile.fullName,
        displayName: str(b.displayName, 60),
        headline: str(b.headline, 300),
        positioning: str(b.positioning, 300),
        rotatingLines: String(b.rotatingLines ?? "")
          .split(/\r?\n/)
          .map((l) => str(l, 120))
          .filter(Boolean)
          .slice(0, 8),
        shortBio: str(b.shortBio, 2000),
        longBioHtml: sanitizeRich(String(b.longBioHtml ?? "")),
        location: str(b.location, 191),
        officeCity: str(b.officeCity, 191),
        email: str(b.email, 191),
        phone: str(b.phone, 60),
        whatsapp: str(b.whatsapp, 60),
        availability: str(b.availability, 191),
        availabilityStatus: b.availabilityStatus === "booked" ? "booked" : "available",
        bookedUntil: str(b.bookedUntil, 60),
        portraitId: num(b.portraitId),
        secondaryPhotoIds: ids,
      });
      break;
    }
    case "branding": {
      const accent = str(b.accentOverride, 7);
      if (accent) {
        if (!/^#[0-9a-f]{6}$/i.test(accent)) {
          flash(res, "error", "Accent colour must be a hex value like #B8925A.");
          return res.redirect(adminUrl("/settings#branding"));
        }
        // Accent is used for rules, outlines and large numbers: require 3:1 against ivory and navy-dark backgrounds.
        const light = contrastRatio(accent, "#F8F6F1");
        const dark = contrastRatio(accent, "#0A1420");
        if (light < 2.2 || dark < 3) {
          flash(res, "error", `That accent doesn't have enough contrast (${light.toFixed(1)}:1 on ivory, ${dark.toFixed(1)}:1 on dark). Pick a deeper or more saturated colour.`);
          return res.redirect(adminUrl("/settings#branding"));
        }
      }
      await saveSetting("branding", {
        logoLightId: num(b.logoLightId),
        logoDarkId: num(b.logoDarkId),
        faviconId: num(b.faviconId),
        accentOverride: accent,
        fontPreset: ["editorial", "classic", "modern"].includes(String(b.fontPreset)) ? (String(b.fontPreset) as "editorial") : "editorial",
        duotonePortrait: b.duotonePortrait === "1" || (Array.isArray(b.duotonePortrait) && b.duotonePortrait.includes("1")),
      });
      break;
    }
    case "seo":
      await saveSetting("seo", {
        siteName: str(b.siteName, 120) || before.seo.siteName,
        titleTemplate: str(b.titleTemplate, 120).includes("%s") ? str(b.titleTemplate, 120) : before.seo.titleTemplate,
        defaultTitle: str(b.defaultTitle, 191),
        defaultDescription: str(b.defaultDescription, 320),
        ogImageId: num(b.ogImageId),
        gscVerification: str(b.gscVerification, 120).replace(/[^\w-]/g, ""),
        ga4Id: /^G-[A-Z0-9]{4,20}$/.test(str(b.ga4Id, 30)) ? str(b.ga4Id, 30) : "",
        twitterHandle: str(b.twitterHandle, 60),
      });
      break;
    case "integrations": {
      const cal = str(b.calendlyUrl, 300);
      await saveSetting("integrations", {
        calendlyUrl: /^https:\/\/([a-z0-9-]+\.)?(calendly\.com|cal\.com)\//i.test(cal) ? cal : "",
        whatsappMessage: str(b.whatsappMessage, 300),
      });
      break;
    }
    case "site":
      assertCan(req, "manage", "settings");
      await saveSetting("site", {
        maintenanceMode: b.maintenanceMode === "1" || (Array.isArray(b.maintenanceMode) && b.maintenanceMode.includes("1")),
        maintenanceMessage: str(b.maintenanceMessage, 300) || before.site.maintenanceMessage,
        footerBlurb: str(b.footerBlurb, 200),
        imageMaxMb: Math.min(25, Math.max(1, Number(b.imageMaxMb) || 8)),
        pdfMaxMb: Math.min(25, Math.max(1, Number(b.pdfMaxMb) || 15)),
        analyticsRetentionDays: Math.min(730, Math.max(30, Number(b.analyticsRetentionDays) || 90)),
        trashRetentionDays: Math.min(365, Math.max(7, Number(b.trashRetentionDays) || 30)),
        newsletterEnabled: b.newsletterEnabled === "1" || (Array.isArray(b.newsletterEnabled) && b.newsletterEnabled.includes("1")),
      });
      break;
    default:
      flash(res, "error", "Unknown settings section.");
      return res.redirect(adminUrl("/settings"));
  }
  const after = await getSettings();
  const k = section as keyof typeof after;
  await audit(req.user, "update", "settings", section, { before: before[k] as Record<string, unknown>, after: after[k] as Record<string, unknown>, ipHash: req.ipHashed });
  bustAll();
  flash(res, "success", "Settings saved.");
  res.redirect(adminUrl(`/settings#${section}`));
}));

siteAdminRouter.post("/settings/test-email", ah(async (req, res) => {
  assertCan(req, "update", "settings");
  const t = mailer();
  if (!t) {
    flash(res, "error", "SMTP isn't configured. Set SMTP_USER and SMTP_PASSWORD in the environment.");
    return res.redirect(adminUrl("/settings#integrations"));
  }
  try {
    const { subject, html, text } = await renderEmail(T.adminNotice("Test email from your website", ["If you can read this, email delivery is working."]));
    await t.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, to: req.user!.email, subject, html, text });
    flash(res, "success", `Test email sent to ${req.user!.email}.`);
  } catch (e) {
    flash(res, "error", `Sending failed: ${(e as Error).message}`);
  }
  res.redirect(adminUrl("/settings#integrations"));
}));

// ── Menus ─────────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/menus", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const menus = await db.select().from(s.menus).orderBy(asc(s.menus.id));
  const items = await db.select().from(s.menuItems).orderBy(asc(s.menuItems.sortOrder));
  const pages = await db.select({ title: s.pages.title, slug: s.pages.slug }).from(s.pages).where(isNull(s.pages.deletedAt));
  const toEditor = (menuId: number) => {
    const list = items.filter((i) => i.menuId === menuId);
    const roots = list.filter((i) => !i.parentId);
    return roots.flatMap((r) => [r, ...list.filter((c) => c.parentId === r.id)]).map((i) => ({ label: i.label, href: i.href, newTab: i.newTab, visible: i.visible, child: Boolean(i.parentId) }));
  };
  await res.page("admin/menus", { layout: "admin", title: "Menus", menus: menus.map((m) => ({ ...m, items: toEditor(m.id) })), pages });
}));

siteAdminRouter.post("/menus/:key", ah(async (req, res) => {
  assertCan(req, "update", "content");
  const menu = (await db.select().from(s.menus).where(eq(s.menus.key, String(req.params.key))))[0];
  if (!menu) return res.redirect(adminUrl("/menus"));
  type MenuInput = { label: string; href: string; newTab: boolean; visible: boolean; child: boolean };
  const items: MenuInput[] = (() => {
    try {
      const v = JSON.parse(String(req.body.items ?? "[]")) as unknown;
      return Array.isArray(v) ? (v as MenuInput[]) : [];
    } catch {
      return [];
    }
  })();
  const clean = items
    .slice(0, 50)
    .map((i) => ({ label: str(i.label, 80), href: str(i.href, 500), newTab: Boolean(i.newTab), visible: i.visible !== false, child: Boolean(i.child) }))
    .filter((i) => i.label && /^(\/|https?:\/\/|mailto:|tel:)/.test(i.href));
  await db.transaction(async (tx) => {
    await tx.delete(s.menuItems).where(eq(s.menuItems.menuId, menu.id));
    let parent: number | null = null;
    for (const [idx, i] of clean.entries()) {
      const [r]: [{ insertId: number }] = await tx.insert(s.menuItems).values({ menuId: menu.id, parentId: i.child ? parent : null, label: i.label, href: i.href, newTab: i.newTab, visible: i.visible, sortOrder: idx }) as unknown as [{ insertId: number }];
      if (!i.child) parent = r.insertId;
    }
  });
  await audit(req.user, "update", "menus", menu.key, { summary: `Saved ${menu.name} menu (${clean.length} items)`, ipHash: req.ipHashed });
  bust("menus");
  flash(res, "success", `${menu.name} menu saved.`);
  res.redirect(adminUrl("/menus"));
}));

// ── Analytics ─────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/analytics", ah(async (req, res) => {
  assertCan(req, "view", "analytics");
  const settings = await getSettings();
  const presets: Record<string, number> = { "1": 1, "7": 7, "30": 30, "90": 90 };
  const range = String(req.query.range ?? "30");
  let from: Date;
  let to = new Date();
  if (range === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.from)) && /^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) {
    from = new Date(`${req.query.from}T00:00:00Z`);
    to = new Date(`${req.query.to}T23:59:59Z`);
  } else {
    const d = presets[range] ?? 30;
    from = d === 1 ? new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z") : new Date(Date.now() - d * 864e5);
  }
  const H = s.analyticsHits;
  const E = s.analyticsEvents;
  const inRange = and(gte(H.ts, from), lt(H.ts, to));
  const n = sql<number>`count(*)`;
  const uniq = sql<number>`count(distinct ${H.visitorHash})`;
  const top = (col: typeof H.path | typeof H.referrer | typeof H.country | typeof H.device | typeof H.browser | typeof H.os, extra?: ReturnType<typeof and>) =>
    db.select({ key: col, n }).from(H).where(and(inRange, extra, sql`${col} is not null`)).groupBy(col).orderBy(desc(n)).limit(10);
  const useDaily = from.getTime() < Date.now() - settings.site.analyticsRetentionDays * 864e5;
  const [totals, series, pages, projects, refs, countries, devices, browsers, oses, utm, events, contactViews] = await Promise.all([
    db.select({ views: n, visitors: uniq }).from(H).where(inRange),
    useDaily
      ? db.select({ day: s.analyticsDaily.day, kind: s.analyticsDaily.kind, value: s.analyticsDaily.value }).from(s.analyticsDaily).where(and(inArray(s.analyticsDaily.kind, ["pageviews", "visitors"]), gte(s.analyticsDaily.day, from.toISOString().slice(0, 10)), sql`${s.analyticsDaily.day} <= ${to.toISOString().slice(0, 10)}`)).orderBy(asc(s.analyticsDaily.day))
      : db.select({ day: sql<string>`DATE(${H.ts})`, views: n, visitors: uniq }).from(H).where(inRange).groupBy(sql`DATE(${H.ts})`).orderBy(sql`DATE(${H.ts})`),
    top(H.path),
    top(H.path, and(like(H.path, "/work/%"))),
    top(H.referrer),
    top(H.country),
    top(H.device),
    top(H.browser),
    top(H.os),
    db.select({ key: sql<string>`concat_ws(' / ', ${H.utmSource}, ${H.utmMedium}, ${H.utmCampaign})`, n }).from(H).where(and(inRange, sql`${H.utmSource} is not null`)).groupBy(H.utmSource, H.utmMedium, H.utmCampaign).orderBy(desc(n)).limit(10),
    db.select({ key: E.name, n, uniq: sql<number>`count(distinct ${E.visitorHash})` }).from(E).where(and(gte(E.ts, from), lt(E.ts, to))).groupBy(E.name).orderBy(desc(n)),
    db.select({ n: uniq }).from(H).where(and(inRange, eq(H.path, "/contact"))),
  ]);
  type Row = { day: string; views: number; visitors: number };
  const seriesRows: Row[] = useDaily
    ? Object.values(
        (series as Array<{ day: string; kind: string; value: number }>).reduce<Record<string, Row>>((acc, r) => {
          acc[r.day] ??= { day: r.day, views: 0, visitors: 0 };
          if (r.kind === "pageviews") acc[r.day]!.views = r.value;
          else acc[r.day]!.visitors = r.value;
          return acc;
        }, {}),
      )
    : (series as Row[]);
  if (req.query.export === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="analytics-${from.toISOString().slice(0, 10)}-${to.toISOString().slice(0, 10)}.csv"`);
    return res.send(`\uFEFF${toCsv(seriesRows.map((r) => ({ ...r, day: String(r.day).slice(0, 10) })), [["day", "Day"], ["visitors", "Visitors"], ["views", "Page views"]])}`);
  }
  const ev = Object.fromEntries(events.map((e) => [e.key, { n: Number(e.n), uniq: Number(e.uniq) }]));
  const visitors = Number(totals[0]?.visitors ?? 0);
  const funnel = [
    ["Visitors", visitors],
    ["Viewed contact page", Number(contactViews[0]?.n ?? 0)],
    ["Sent a message", ev.contact_submit?.uniq ?? 0],
  ] as Array<[string, number]>;
  await res.page("admin/analytics", {
    layout: "admin",
    title: "Analytics",
    range,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    totals: { views: Number(totals[0]?.views ?? 0), visitors },
    series: seriesRows,
    pages,
    projects,
    refs,
    countries,
    devices,
    browsers,
    oses,
    utm,
    events,
    funnel,
  });
}));

// ── Users & roles ─────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/users", ah(async (req, res) => {
  assertCan(req, "view", "users");
  const list = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role, totpEnabled: s.users.totpEnabled, isActive: s.users.isActive, lastLoginAt: s.users.lastLoginAt, lockedUntil: s.users.lockedUntil }).from(s.users).orderBy(asc(s.users.id));
  await res.page("admin/users", { layout: "admin", title: "Users & roles", users: list, roles: s.ROLES });
}));

siteAdminRouter.post("/users", ah(async (req, res) => {
  assertCan(req, "manage", "users");
  const name = str(req.body.name, 191);
  const email = String(req.body.email ?? "").trim().toLowerCase();
  const role = (s.ROLES as readonly string[]).includes(String(req.body.role)) && req.body.role !== "owner" ? (String(req.body.role) as "editor") : "editor";
  const pw = String(req.body.password ?? "");
  const problems = passwordProblems(pw, { email, name });
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.unshift("Enter a name and a valid email.");
  if ((await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, email))).length) problems.unshift("A user with that email already exists.");
  if (problems.length) {
    flash(res, "error", problems.join(" "));
    return res.redirect(adminUrl("/users"));
  }
  const [r] = await db.insert(s.users).values({ name, email, role, passwordHash: await hashPassword(pw) });
  await audit(req.user, "create", "users", r.insertId, { summary: `Created ${role} ${email}`, ipHash: req.ipHashed });
  if (req.body.sendReset === "1") await requestPasswordReset(email);
  flash(res, "success", `User ${email} created as ${role}. Share the temporary password securely, or they can use “Forgot password”.`);
  res.redirect(adminUrl("/users"));
}));

siteAdminRouter.post("/users/:id", ah(async (req, res) => {
  assertCan(req, "manage", "users");
  const id = Number(req.params.id);
  const target = (await db.select().from(s.users).where(eq(s.users.id, id)))[0];
  if (!target) return res.redirect(adminUrl("/users"));
  const action = String(req.body.action);
  if (id === req.user!.id && action !== "reset") {
    flash(res, "error", "You can't change your own role or status here.");
    return res.redirect(adminUrl("/users"));
  }
  if (target.role === "owner") {
    const owners = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.role, "owner"), eq(s.users.isActive, true), ne(s.users.id, id)));
    if (!owners.length && action !== "reset") {
      flash(res, "error", "There must always be at least one active Owner.");
      return res.redirect(adminUrl("/users"));
    }
  }
  if (action === "role" && (s.ROLES as readonly string[]).includes(String(req.body.role))) {
    await db.update(s.users).set({ role: String(req.body.role) as "editor" }).where(eq(s.users.id, id));
    await destroyOtherSessions(id);
  } else if (action === "deactivate" || action === "activate") {
    await db.update(s.users).set({ isActive: action === "activate" }).where(eq(s.users.id, id));
    if (action === "deactivate") await destroyOtherSessions(id);
  } else if (action === "unlock") {
    await db.update(s.users).set({ lockedUntil: null, failedAttempts: 0 }).where(eq(s.users.id, id));
  } else if (action === "reset") {
    await requestPasswordReset(target.email);
  } else if (action === "delete") {
    await db.delete(s.users).where(eq(s.users.id, id));
  }
  await audit(req.user, `user_${action}`, "users", id, { summary: `${action} ${target.email}${action === "role" ? ` → ${req.body.role}` : ""}`, ipHash: req.ipHashed });
  flash(res, "success", action === "reset" ? `Password reset link sent to ${target.email}.` : "User updated.");
  res.redirect(adminUrl("/users"));
}));

// ── Audit log ─────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/audit", ah(async (req, res) => {
  assertCan(req, "view", "audit");
  const f = { user: String(req.query.user ?? ""), resource: String(req.query.resource ?? ""), action: String(req.query.action ?? ""), q: String(req.query.q ?? "") };
  const page = Math.max(1, Number(req.query.page) || 1);
  const A = s.auditLogs;
  const where = and(
    /^\d+$/.test(f.user) ? eq(A.userId, Number(f.user)) : undefined,
    f.resource ? eq(A.resource, f.resource) : undefined,
    f.action ? eq(A.action, f.action) : undefined,
    f.q ? or(like(A.summary, `%${f.q.replace(/[%_\\]/g, "\\$&")}%`), eq(A.resourceId, f.q)) : undefined,
  );
  const [rows, total, resources, actions, users] = await Promise.all([
    db.select().from(A).where(where).orderBy(desc(A.createdAt)).limit(50).offset((page - 1) * 50),
    db.select({ n: sql<number>`count(*)` }).from(A).where(where),
    db.selectDistinct({ r: A.resource }).from(A),
    db.selectDistinct({ a: A.action }).from(A),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users),
  ]);
  await res.page("admin/audit", { layout: "admin", title: "Audit log", rows, f, page, pages: Math.max(1, Math.ceil(Number(total[0]?.n ?? 0) / 50)), resources: resources.map((r) => r.r).sort(), actions: actions.map((a) => a.a).sort(), users });
}));

// ── Backups ───────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/backups", ah(async (req, res) => {
  assertCan(req, "manage", "system");
  await res.page("admin/backups", { layout: "admin", title: "Backups", s3: s3Configured(), uploadDir, cron: Boolean(env.CRON_SECRET) });
}));

siteAdminRouter.get("/backups/export.zip", ah(async (req, res) => {
  assertCan(req, "manage", "system");
  const zip = await buildBackupZip();
  await audit(req.user, "export", "system", null, { summary: `Downloaded backup (${(zip.length / 1048576).toFixed(1)} MB)`, ipHash: req.ipHashed });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="tj-portfolio-backup-${new Date().toISOString().slice(0, 10)}.zip"`);
  res.send(zip);
}));

siteAdminRouter.get("/backups/export.json", ah(async (req, res) => {
  assertCan(req, "manage", "system");
  const { exportData } = await import("../../server/backup.js");
  res.setHeader("Content-Disposition", `attachment; filename="tj-portfolio-content-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json({ version: 1, createdAt: new Date().toISOString(), tables: await exportData() });
}));

siteAdminRouter.post("/backups/import", upload.single("file"), ah(async (req, res) => {
  if (!checkCsrf(req)) return res.status(403).send("Session expired — reload the page.");
  assertCan(req, "manage", "system");
  if (req.user!.role !== "owner") throw Object.assign(new Error("Only the Owner can restore backups."), { status: 403 });
  if (String(req.body.confirm ?? "") !== "RESTORE" || !req.file) {
    flash(res, "error", "Choose a backup zip and type RESTORE to confirm.");
    return res.redirect(adminUrl("/backups"));
  }
  try {
    const r = await restoreBackup(req.file.buffer);
    await audit(req.user, "import", "system", null, { summary: `Restored backup: ${r.rows} rows, ${r.files} files`, ipHash: req.ipHashed });
    flash(res, "success", `Backup restored: ${r.rows} rows and ${r.files} files.`);
  } catch (e) {
    flash(res, "error", `Restore failed: ${(e as Error).message}`);
  }
  res.redirect(adminUrl("/backups"));
}));

// ── System ────────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/system", ah(async (req, res) => {
  assertCan(req, "manage", "system");
  const [jobs, migrations, mediaCounts] = await Promise.all([
    db.select().from(s.jobs).where(inArray(s.jobs.status, ["pending", "failed"])).orderBy(desc(s.jobs.createdAt)).limit(50),
    db.execute(sql`SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC LIMIT 5`).then((r) => (r as unknown as [Array<{ id: number; created_at: number }>])[0]).catch(() => []),
    db.select({ driver: s.media.driver, n: sql<number>`count(*)` }).from(s.media).groupBy(s.media.driver),
  ]);
  await res.page("admin/system", {
    layout: "admin",
    title: "System",
    jobs,
    migrations,
    mediaCounts,
    storage: storageHealth(),
    sharp: sharpStatus(),
    info: { node: process.version, env: env.NODE_ENV, uptime: Math.round(process.uptime()), memory: Math.round(process.memoryUsage().rss / 1048576), cache: cacheSize(), driver: env.STORAGE_DRIVER, s3: s3Configured(), adminPath: env.ADMIN_PATH },
  });
}));

siteAdminRouter.post("/system/:action", ah(async (req, res) => {
  assertCan(req, "manage", "system");
  const action = String(req.params.action);
  let msg = "Done.";
  if (action === "migrate") {
    const r = await runMigrations();
    msg = `Migrations are up to date (${r.ms} ms).`;
  } else if (action === "storage") {
    const h = await checkStorage();
    msg = `${h.driver}: ${h.detail}`;
  } else if (action === "cache") {
    bustAll();
    msg = "Cache cleared.";
  } else if (action === "jobs") {
    await db.update(s.jobs).set({ status: "pending", runAt: new Date() }).where(eq(s.jobs.status, "failed"));
    const r = await runJobs(50);
    msg = `Queue processed: ${r.sent} sent, ${r.failed} still failing.`;
  } else if (action === "rollup") {
    msg = `Analytics rolled up (${await rollup(7)} rows).`;
  } else if (action === "copy-to-s3") {
    if (!s3Configured()) msg = "S3 isn't configured.";
    else {
      const rows = await db.select().from(s.media).where(eq(s.media.driver, "local")).limit(200);
      let copied = 0;
      for (const m of rows) {
        for (const k of [m.key, ...(m.variants ?? []).map((v) => v.key)]) {
          const buf = await driver("local").getBuffer(k);
          if (buf) await driver("s3").put(k, buf, k === m.key ? m.mime : "image/webp");
        }
        await db.update(s.media).set({ driver: "s3" }).where(eq(s.media.id, m.id));
        copied++;
      }
      bustAll();
      msg = `Copied ${copied} file(s) to S3${rows.length === 200 ? " — run again to continue" : ""}. Local copies are kept as a fallback.`;
    }
  }
  await audit(req.user, `system_${action}`, "system", null, { summary: msg, ipHash: req.ipHashed });
  flash(res, "success", msg);
  res.redirect(adminUrl("/system"));
}));

// ── ⌘K search ─────────────────────────────────────────────────────────────────────────────────────
siteAdminRouter.get("/search", ah(async (req, res) => {
  const q = String(req.query.q ?? "").trim().slice(0, 80);
  if (q.length < 2) return res.json({ items: [] });
  const t = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const items: Array<{ label: string; group: string; href: string }> = [];
  const canContent = res.locals.user && ["owner", "admin", "editor", "viewer"].includes(req.user!.role);
  if (canContent) {
    const [p, tr, po, ce] = await Promise.all([
      db.select({ id: s.projects.id, t: s.projects.title }).from(s.projects).where(and(isNull(s.projects.deletedAt), like(s.projects.title, t))).limit(5),
      db.select({ id: s.trainings.id, t: s.trainings.title }).from(s.trainings).where(and(isNull(s.trainings.deletedAt), like(s.trainings.title, t))).limit(5),
      db.select({ id: s.posts.id, t: s.posts.title }).from(s.posts).where(and(isNull(s.posts.deletedAt), like(s.posts.title, t))).limit(5),
      db.select({ id: s.certifications.id, t: s.certifications.name }).from(s.certifications).where(and(isNull(s.certifications.deletedAt), like(s.certifications.name, t))).limit(3),
    ]);
    p.forEach((r) => items.push({ label: r.t, group: "Projects", href: adminUrl(`/content/projects/${r.id}`) }));
    tr.forEach((r) => items.push({ label: r.t, group: "Trainings", href: adminUrl(`/content/trainings/${r.id}`) }));
    po.forEach((r) => items.push({ label: r.t, group: "Insights", href: adminUrl(`/content/posts/${r.id}`) }));
    ce.forEach((r) => items.push({ label: r.t, group: "Certifications", href: adminUrl(`/content/certifications/${r.id}`) }));
  }
  if (["owner", "admin", "viewer"].includes(req.user!.role)) {
    const [m, tk] = await Promise.all([
      db.select({ id: s.messages.id, n: s.messages.name, e: s.messages.email }).from(s.messages).where(or(like(s.messages.name, t), like(s.messages.email, t))).limit(5),
      db.select({ id: s.maintenanceTickets.id, n: s.maintenanceTickets.ticketNo, c: s.maintenanceTickets.clientName }).from(s.maintenanceTickets).where(or(like(s.maintenanceTickets.ticketNo, t), like(s.maintenanceTickets.clientName, t))).limit(5),
    ]);
    m.forEach((r) => items.push({ label: `${r.n} <${r.e}>`, group: "Messages", href: adminUrl(`/inbox/${r.id}`) }));
    tk.forEach((r) => items.push({ label: `${r.n} — ${r.c}`, group: "Tickets", href: adminUrl(`/tickets/${r.id}`) }));
  }
  res.json({ items });
}));
