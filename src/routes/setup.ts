import { Router } from "express";
import { eq, sql } from "drizzle-orm";
import { db, dbHealth } from "../db/index.js";
import { users } from "../db/schema/index.js";
import { adminUrl, env, smtpConfigured } from "../config/env.js";
import { runMigrations } from "../db/migrate.js";
import { runSeed } from "../db/seed/index.js";
import { checkStorage } from "../lib/storage/index.js";
import { hashPassword, passwordProblems } from "../lib/auth/password.js";
import { safeEqual } from "../lib/crypto.js";
import { audit } from "../lib/audit.js";
import { bustAll } from "../lib/cache.js";
import { saveSetting } from "../server/settings.js";
import { startSession } from "../server/auth.js";
import { email as emailSchema, parse, str, z } from "../lib/validation.js";
import { rateLimit } from "../lib/rate-limit.js";
import { ah } from "./admin/mw.js";

export const setupRouter = Router();

async function ownerExists(): Promise<boolean> {
  try {
    const r = await db.select({ n: sql<number>`count(*)` }).from(users).where(eq(users.role, "owner"));
    return Number(r[0]?.n ?? 0) > 0;
  } catch {
    return false; // users table may not exist yet — migrations run below
  }
}

function tokenOk(t: unknown): boolean {
  return Boolean(env.SETUP_TOKEN) && typeof t === "string" && safeEqual(t, env.SETUP_TOKEN!);
}

/**
 * First-run wizard (brief §12.5). Works only while no Owner exists AND the correct SETUP_TOKEN
 * is supplied; afterwards it permanently returns 404.
 */
setupRouter.use(ah(async (req, res, next) => {
  if (await ownerExists()) return res.status(404).type("text").send("Not found");
  const token = req.method === "GET" ? req.query.token : req.body?.token;
  if (!tokenOk(token)) {
    const lim = await rateLimit("setup", req.ipHashed, 10, 3600).catch(() => ({ ok: true }));
    return res.status(lim.ok ? 404 : 429).type("text").send("Not found");
  }
  next();
}));

setupRouter.get("/", ah(async (req, res) => {
  const db1 = await dbHealth();
  let migrations: { ok: boolean; detail: string } = { ok: false, detail: "Database not reachable" };
  if (db1.ok) {
    try {
      const r = await runMigrations();
      migrations = { ok: true, detail: `Up to date (${r.ms} ms)` };
    } catch (e) {
      migrations = { ok: false, detail: (e as Error).message };
    }
  }
  const storage = await checkStorage().catch((e) => ({ ok: false, detail: (e as Error).message, driver: env.STORAGE_DRIVER }));
  const checks = [
    { label: "Database connection", ok: db1.ok, detail: db1.ok ? `MySQL ${db1.version}` : db1.error ?? "Unavailable" },
    { label: "Migrations", ok: migrations.ok, detail: migrations.detail },
    { label: `Upload storage (${storage.driver})`, ok: storage.ok, detail: storage.detail },
    { label: "Email (SMTP)", ok: smtpConfigured, optional: true, detail: smtpConfigured ? `${env.SMTP_HOST}:${env.SMTP_PORT} as ${env.SMTP_USER}` : "Not configured — optional now, needed for notifications and password resets" },
  ];
  await res.page("admin/setup", { layout: "auth", title: "Setup", checks, token: req.query.token, ready: db1.ok && migrations.ok, values: {} });
}));

const ownerSchema = z.object({
  name: str(191, "Name"),
  email: emailSchema,
  password: z.string().max(200),
  confirm: z.string(),
  seed: z.string().optional(),
});

setupRouter.post("/", ah(async (req, res) => {
  const parsed = parse(ownerSchema, req.body);
  const values = { name: req.body.name, email: req.body.email };
  const rerender = async (errors: string[]) =>
    res.page("admin/setup", { layout: "auth", title: "Setup", checks: [], token: req.body.token, ready: true, values, errors }, 400);
  if (!parsed.ok) return rerender(Object.values(parsed.errors));
  const d = parsed.data;
  const problems = passwordProblems(d.password, { email: d.email, name: d.name });
  if (d.password !== d.confirm) problems.push("The two passwords don't match.");
  if (problems.length) return rerender(problems);

  await runMigrations();
  if (await ownerExists()) return res.status(404).send("Not found");
  const [r] = await db.insert(users).values({ email: d.email, name: d.name, role: "owner", passwordHash: await hashPassword(d.password) });
  const userId = r.insertId;
  await audit({ id: userId, name: d.name }, "setup", "system", null, { summary: "owner account created", ipHash: req.ipHashed });
  let seeded = false;
  if (d.seed) {
    await runSeed();
    seeded = true;
  }
  await saveSetting("setup", { completedAt: new Date().toISOString(), seeded });
  bustAll();
  await startSession(req, res, userId, false);
  // Owner without TOTP is sent straight to mandatory 2FA enrolment by requireAuth.
  res.redirect(adminUrl("/account/2fa"));
}));
