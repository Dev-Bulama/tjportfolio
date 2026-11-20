import os from "node:os";
import path from "node:path";
import request from "supertest";
import { generate } from "otplib";
import type { Express } from "express";

// Must be set before any app module is imported.
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `tj-test-uploads-${process.pid}`);
process.env.SETUP_TOKEN = "test-setup-token";
process.env.CRON_SECRET = "test-cron-secret";
process.env.ADMIN_PATH = "admin";

export async function dbAvailable(): Promise<boolean> {
  try {
    const { dbHealth } = await import("../../src/db/index.js");
    return (await dbHealth()).ok;
  } catch {
    return false;
  }
}

/** Fresh schema: drop every table, then run migrations. */
export async function resetDb(): Promise<void> {
  const { pool } = await import("../../src/db/index.js");
  const [rows] = await pool.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()");
  await pool.query("SET FOREIGN_KEY_CHECKS = 0");
  for (const r of rows as Array<{ t: string }>) await pool.query(`DROP TABLE IF EXISTS \`${r.t}\``);
  await pool.query("SET FOREIGN_KEY_CHECKS = 1");
  const { runMigrations } = await import("../../src/db/migrate.js");
  await runMigrations();
  const { bustAll } = await import("../../src/lib/cache.js");
  bustAll();
}

let app: Express | null = null;
export async function getApp(): Promise<Express> {
  if (!app) app = (await import("../../src/app.js")).createApp();
  return app;
}

export const csrfFrom = (html: string): string => /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? "";

/** An agent that keeps cookies and knows the current CSRF token. */
export async function agent(startPath = "/contact") {
  const a = request.agent(await getApp());
  const res = await a.get(startPath);
  return { a, csrf: csrfFrom(res.text) };
}

export const OWNER = { name: "Test Owner", email: "owner@test.local", password: "Correct-Horse-Battery-9" };

/** Runs the setup wizard, enrols TOTP, and returns a signed-in agent + TOTP secret. */
export async function setupOwner(seed = false) {
  const a = request.agent(await getApp());
  const page = await a.get("/setup?token=test-setup-token");
  const res = await a
    .post("/setup")
    .type("form")
    .send({ _csrf: csrfFrom(page.text), token: "test-setup-token", ...OWNER, confirm: OWNER.password, ...(seed ? { seed: "1" } : {}) });
  if (res.status !== 302) throw new Error(`setup failed: ${res.status} ${res.text.slice(0, 300)}`);
  const enrol = await a.get("/admin/account/2fa");
  const secret = /<code[^>]*>([A-Z2-7 ]+)<\/code>/.exec(enrol.text)?.[1]?.replace(/\s+/g, "") ?? "";
  const confirm = await a.post("/admin/account/2fa").type("form").send({ _csrf: csrfFrom(enrol.text), code: await generate({ secret }) });
  if (confirm.status !== 200) throw new Error(`2fa enrol failed: ${confirm.status}`);
  const dash = await a.get("/admin/");
  return { a, secret, csrf: csrfFrom(dash.text), codes: [...confirm.text.matchAll(/>([a-z0-9x]{4}-[a-z0-9x]{4}-[a-z0-9x]{4})</g)].map((m) => m[1]!) };
}
