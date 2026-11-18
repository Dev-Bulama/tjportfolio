import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { csrfFrom, dbAvailable, getApp, resetDb, setupOwner } from "./helpers.js";

const ok = await dbAvailable();

describe.skipIf(!ok)("content engine & public visibility", () => {
  let owner: Awaited<ReturnType<typeof setupOwner>>;

  beforeAll(async () => {
    await resetDb();
    owner = await setupOwner(true); // with seed
  });
  afterAll(async () => {
    const { pool } = await import("../../src/db/index.js");
    await pool.end();
  });

  it("seed is idempotent", async () => {
    const { runSeed } = await import("../../src/db/seed/index.js");
    expect((await runSeed()).created).toBe(0);
  });

  it("never shows sample testimonials, sample certifications or placeholders publicly", async () => {
    const app = await getApp();
    const reviews = await request(app).get("/testimonials");
    expect(reviews.text).not.toContain("Sample Reviewer");
    const certs = await request(app).get("/certifications");
    expect(certs.text).not.toContain("[[");
    const home = await request(app).get("/");
    expect(home.status).toBe(200);
    expect(home.text).not.toMatch(/\[\[/);
    expect((await request(app).get("/about")).text).not.toMatch(/\[\[/);
  });

  it("creates, publishes, duplicates, trashes, restores and permanently deletes a project", async () => {
    const app = await getApp();
    const form = await owner.a.get("/admin/content/projects/new");
    const created = await owner.a
      .post("/admin/content/projects/new")
      .type("form")
      .send({ _csrf: csrfFrom(form.text), title: "Integration Test Project", slug: "", summary: "Built by a test.", status: "draft", projectStatus: "completed", bodyHtml: "<p>Body</p>", metrics: "[]" });
    expect(created.status).toBe(302);
    const id = Number(/projects\/(\d+)/.exec(created.headers.location!)![1]);
    expect((await request(app).get("/work/integration-test-project")).status).toBe(404); // draft

    // preview works for staff only
    expect((await owner.a.get("/work/integration-test-project?preview=1")).status).toBe(200);
    expect((await request(app).get("/work/integration-test-project?preview=1")).status).toBe(404);

    const edit = await owner.a.get(`/admin/content/projects/${id}`);
    await owner.a.post(`/admin/content/projects/${id}`).type("form").send({ _csrf: csrfFrom(edit.text), title: "Integration Test Project", slug: "integration-test-project", summary: "Built by a test.", status: "published", projectStatus: "completed", bodyHtml: "<p>Body</p>", metrics: "[]" });
    const pub = await request(app).get("/work/integration-test-project");
    expect(pub.status).toBe(200);
    expect(pub.text).toContain("Integration Test Project");
    expect((await request(app).get("/work")).text).toContain("Integration Test Project");

    const dup = await owner.a.post(`/admin/content/projects/${id}/duplicate`).type("form").send({ _csrf: owner.csrf });
    expect(dup.headers.location).toMatch(/projects\/\d+/);

    await owner.a.post(`/admin/content/projects/${id}/trash`).type("form").send({ _csrf: owner.csrf });
    expect((await request(app).get("/work/integration-test-project")).status).toBe(404);
    const trash = await owner.a.get("/admin/content/projects?trash=1");
    expect(trash.text).toContain("Integration Test Project");

    await owner.a.post("/admin/content/projects/bulk").type("form").send({ _csrf: owner.csrf, action: "restore", ids: String(id), trash: "1" });
    expect((await request(app).get("/work/integration-test-project")).status).toBe(200);

    await owner.a.post("/admin/content/projects/bulk").type("form").send({ _csrf: owner.csrf, action: "trash", ids: String(id) });
    await owner.a.post("/admin/content/projects/bulk").type("form").send({ _csrf: owner.csrf, action: "destroy", ids: String(id), trash: "1" });
    const { db } = await import("../../src/db/index.js");
    const { projects } = await import("../../src/db/schema/index.js");
    const { eq } = await import("drizzle-orm");
    expect(await db.select().from(projects).where(eq(projects.id, id))).toHaveLength(0);
  });

  it("refuses to publish a sample certification", async () => {
    const list = await owner.a.get("/admin/content/certifications");
    const id = /content\/certifications\/(\d+)"/.exec(list.text)![1];
    const page = await owner.a.get(`/admin/content/certifications/${id}`);
    const r = await owner.a.post(`/admin/content/certifications/${id}`).type("form").send({ _csrf: csrfFrom(page.text), name: "[[Certification name]]", issuer: "[[Issuer]]", slug: "sample-aws", status: "published", isSample: "1" });
    expect(r.status).toBe(422);
    expect(r.text).toMatch(/placeholder|Sample/);
  });

  it("reorders items", async () => {
    const { db } = await import("../../src/db/index.js");
    const { stats } = await import("../../src/db/schema/index.js");
    const { asc } = await import("drizzle-orm");
    const before = await db.select().from(stats).orderBy(asc(stats.sortOrder));
    const reversed = before.map((s) => s.id).reverse();
    const r = await owner.a.post("/admin/content/stats/reorder").set("x-csrf-token", owner.csrf).type("form").send(reversed.map((i) => `ids=${i}`).join("&"));
    expect(r.body.ok).toBe(true);
    const after = await db.select().from(stats).orderBy(asc(stats.sortOrder));
    expect(after.map((s) => s.id)).toEqual(reversed);
  });

  it("publishes scheduled posts lazily once due, and cron flips them", async () => {
    const app = await getApp();
    const { db } = await import("../../src/db/index.js");
    const { posts } = await import("../../src/db/schema/index.js");
    const { eq } = await import("drizzle-orm");
    const { bustAll } = await import("../../src/lib/cache.js");
    await db.update(posts).set({ status: "scheduled", publishedAt: new Date(Date.now() + 3600e3) }).where(eq(posts.slug, "why-oracle-rac-still-matters"));
    bustAll();
    expect((await request(app).get("/insights/why-oracle-rac-still-matters")).status).toBe(404);
    await db.update(posts).set({ publishedAt: new Date(Date.now() - 60e3) }).where(eq(posts.slug, "why-oracle-rac-still-matters"));
    bustAll();
    expect((await request(app).get("/insights/why-oracle-rac-still-matters")).status).toBe(200);
    const cron = await request(app).get("/api/cron?secret=test-cron-secret&task=publish");
    expect(cron.body.ran.publish.published).toBeGreaterThanOrEqual(1);
    expect((await request(app).get("/api/cron?secret=nope")).status).toBe(401);
  });

  it("serves SEO endpoints", async () => {
    const app = await getApp();
    const sm = await request(app).get("/sitemap.xml");
    expect(sm.text).toContain("<urlset");
    expect(sm.text).toContain("/training/");
    expect((await request(app).get("/robots.txt")).text).toContain("Disallow: /admin/");
    expect((await request(app).get("/rss.xml")).text).toContain("<rss");
    const home = await request(app).get("/");
    expect(home.text).toContain('"@type":"Person"');
    expect(home.headers["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(home.headers["x-content-type-options"]).toBe("nosniff");
  });
});
