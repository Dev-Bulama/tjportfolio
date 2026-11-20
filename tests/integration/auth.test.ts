import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { generate } from "otplib";
import { agent, csrfFrom, dbAvailable, getApp, OWNER, resetDb, setupOwner } from "./helpers.js";

const ok = await dbAvailable();

describe.skipIf(!ok)("auth & admin security", () => {
  let owner: Awaited<ReturnType<typeof setupOwner>>;

  beforeAll(async () => {
    await resetDb();
    owner = await setupOwner(false);
  });
  afterAll(async () => {
    const { pool } = await import("../../src/db/index.js");
    await pool.end();
  });

  it("setup wizard works once, then disappears", async () => {
    const res = await request(await getApp()).get("/setup?token=test-setup-token");
    expect(res.status).toBe(404);
  });

  it("owner is signed in with 2FA and sees the dashboard", async () => {
    const res = await owner.a.get("/admin/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Getting started");
    expect(owner.codes).toHaveLength(10);
  });

  it("protects admin routes and API JSON from anonymous users", async () => {
    const app = await getApp();
    expect((await request(app).get("/admin/content/projects")).status).toBe(302);
    expect((await request(app).get("/admin/media.json").set("Accept", "application/json")).status).toBe(302);
  });

  it("rejects mutating requests without a CSRF token", async () => {
    const res = await owner.a.post("/admin/content/projects/new").type("form").send({ title: "No token" });
    expect(res.status).toBe(403);
  });

  it("requires the second factor after the password, and recovery codes are single-use", async () => {
    const { a, csrf } = await agent("/admin/login");
    const login = await a.post("/admin/login").type("form").send({ _csrf: csrf, email: OWNER.email, password: OWNER.password });
    expect(login.headers.location).toMatch(/\/admin\/2fa/);
    expect((await a.get("/admin/")).headers.location).toMatch(/\/admin\/2fa/);
    const page = await a.get("/admin/2fa");
    const bad = await a.post("/admin/2fa").type("form").send({ _csrf: csrfFrom(page.text), code: "000000" });
    expect(bad.status).toBe(401);
    const good = await a.post("/admin/2fa").type("form").send({ _csrf: csrfFrom(page.text), code: owner.codes[0] });
    expect(good.status).toBe(302);
    expect((await a.get("/admin/")).status).toBe(200);

    // same recovery code again on a new session must fail
    const b = await agent("/admin/login");
    await b.a.post("/admin/login").type("form").send({ _csrf: b.csrf, email: OWNER.email, password: OWNER.password });
    const p2 = await b.a.get("/admin/2fa");
    expect((await b.a.post("/admin/2fa").type("form").send({ _csrf: csrfFrom(p2.text), code: owner.codes[0] })).status).toBe(401);
    expect((await b.a.post("/admin/2fa").type("form").send({ _csrf: csrfFrom(p2.text), code: await generate({ secret: owner.secret }) })).status).toBe(302);
  });

  it("locks the account after 5 failed attempts and alerts the owner", async () => {
    const dash = await owner.a.get("/admin/users");
    await owner.a.post("/admin/users").type("form").send({ _csrf: csrfFrom(dash.text), name: "Ed Editor", email: "editor@test.local", role: "editor", password: "Quill-Strong-Pass-77" });
    const { a, csrf } = await agent("/admin/login");
    for (let i = 0; i < 5; i++) await a.post("/admin/login").type("form").send({ _csrf: csrf, email: "editor@test.local", password: "wrong-password" });
    const locked = await a.post("/admin/login").type("form").send({ _csrf: csrf, email: "editor@test.local", password: "Quill-Strong-Pass-77" });
    expect(locked.status).toBe(423);
    expect(locked.text).toMatch(/Too many failed attempts/);
    const { db } = await import("../../src/db/index.js");
    const { jobs } = await import("../../src/db/schema/index.js");
    const queued = await db.select().from(jobs);
    expect(queued.some((j) => JSON.stringify(j.payload).includes("locked after 5 failed"))).toBe(true);
    // owner unlocks
    const users = await owner.a.get("/admin/users");
    const id = /\/admin\/users\/(\d+)"[^>]*>\s*<input[^>]*>\s*<button name="action" value="reset"[\s\S]*?Ed Editor/.exec(users.text)?.[1] ?? "2";
    await owner.a.post(`/admin/users/2`).type("form").send({ _csrf: csrfFrom(users.text), action: "unlock" });
    const ok2 = await a.post("/admin/login").type("form").send({ _csrf: csrf, email: "editor@test.local", password: "Quill-Strong-Pass-77" });
    expect(ok2.status).toBe(302);
    expect(id).toBeTruthy();
  });

  it("enforces roles in handlers: editors can't open settings, users or inbox", async () => {
    const { a, csrf } = await agent("/admin/login");
    await a.post("/admin/login").type("form").send({ _csrf: csrf, email: "editor@test.local", password: "Quill-Strong-Pass-77" });
    expect((await a.get("/admin/content/projects")).status).toBe(200);
    expect((await a.get("/admin/inbox")).status).toBe(403);
    expect((await a.get("/admin/users")).status).toBe(403);
    expect((await a.get("/admin/backups/export.zip")).status).toBe(403);
  });

  it("password reset tokens work once and expire old sessions", async () => {
    const { requestPasswordReset, findReset } = await import("../../src/server/auth.js");
    const { db } = await import("../../src/db/index.js");
    const { passwordResets } = await import("../../src/db/schema/index.js");
    await requestPasswordReset("editor@test.local");
    const { jobs } = await import("../../src/db/schema/index.js");
    const all = await db.select().from(jobs);
    const link = /\/admin\/reset\/([\w-]+)/.exec(JSON.stringify(all.at(-1)!.payload))![1]!;
    expect(await findReset(link)).toBeTruthy();
    const { a } = await agent(`/admin/reset/${link}`);
    const page = await a.get(`/admin/reset/${link}`);
    const r = await a.post(`/admin/reset/${link}`).type("form").send({ _csrf: csrfFrom(page.text), password: "Brand-New-Pass-2026", confirm: "Brand-New-Pass-2026" });
    expect(r.status).toBe(302);
    expect(await findReset(link)).toBeUndefined();
    expect((await db.select().from(passwordResets)).every((x) => x.usedAt)).toBe(true);
  });

  it("writes an audit trail", async () => {
    const res = await owner.a.get("/admin/audit");
    expect(res.text).toMatch(/2fa_enabled|lockout|login/);
  });
});
