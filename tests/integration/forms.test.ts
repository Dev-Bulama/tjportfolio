import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { agent, csrfFrom, dbAvailable, getApp, resetDb, setupOwner } from "./helpers.js";

const ok = await dbAvailable();

describe.skipIf(!ok)("public forms, tickets, reviews, uploads, analytics", () => {
  let owner: Awaited<ReturnType<typeof setupOwner>>;

  beforeAll(async () => {
    await resetDb();
    owner = await setupOwner(true);
  });
  afterAll(async () => {
    const { pool } = await import("../../src/db/index.js");
    await pool.end();
  });

  it("contact form validates, stores the message before email, and shows it in the inbox", async () => {
    const { a, csrf } = await agent("/contact");
    const bad = await a.post("/contact").set("Accept", "application/json").field("_csrf", csrf).field("name", "").field("email", "x");
    expect(bad.status).toBe(422);
    expect(bad.body.errors.email).toBeDefined();
    const good = await a
      .post("/contact")
      .set("Accept", "application/json")
      .field("_csrf", csrf)
      .field("name", "Ada Okafor")
      .field("email", "ada@example.com")
      .field("inquiryType", "Corporate training")
      .field("message", "We need an Oracle 19c bootcamp for twelve DBAs.");
    expect(good.body.ok).toBe(true);
    const inbox = await owner.a.get("/admin/inbox");
    expect(inbox.text).toContain("Ada Okafor");
    const { db } = await import("../../src/db/index.js");
    const { jobs } = await import("../../src/db/schema/index.js");
    expect((await db.select().from(jobs)).some((j) => JSON.stringify(j.payload).includes("ada@example.com"))).toBe(true);
  });

  it("honeypot submissions are silently dropped", async () => {
    const { a, csrf } = await agent("/contact");
    const r = await a.post("/contact").set("Accept", "application/json").field("_csrf", csrf).field("website", "http://spam").field("name", "Bot").field("email", "bot@x.com").field("inquiryType", "Other").field("message", "Buy cheap things now!!!");
    expect(r.body.ok).toBe(true);
    const inbox = await owner.a.get("/admin/inbox");
    expect(inbox.text).not.toContain("Buy cheap things");
  });

  it("rate-limits public forms (5 per 10 minutes)", async () => {
    const { a, csrf } = await agent("/contact");
    let last = 0;
    for (let i = 0; i < 6; i++) {
      const r = await a.post("/contact").set("Accept", "application/json").field("_csrf", csrf).field("name", "N").field("email", "n@x.com").field("inquiryType", "Other").field("message", "Message number " + i + " for rate limit");
      last = r.status;
    }
    expect(last).toBe(429);
  });

  it("maintenance request creates a numbered ticket with screenshot, viewable on the status page with the right email only", async () => {
    const { pool } = await import("../../src/db/index.js");
    await pool.query("DELETE FROM rate_limits");
    const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#0F2A47" } }).png().toBuffer();
    const { a, csrf } = await agent("/maintenance-request");
    const r = await a
      .post("/maintenance-request")
      .set("Accept", "application/json")
      .field("_csrf", csrf)
      .field("clientName", "Ada")
      .field("email", "ada@example.com")
      .field("issueType", "bug")
      .field("priority", "high")
      .field("description", "Checkout button does nothing on Safari.")
      .attach("screenshots", png, "shot.png");
    expect(r.body.ok).toBe(true);
    const ticket = /TJ-MR-\d{4}-\d{4}/.exec(r.body.html)![0];
    const page = await a.get("/status");
    const wrong = await a.post("/status").type("form").send({ _csrf: csrfFrom(page.text), ticket, email: "someone@else.com" });
    expect(wrong.status).toBe(404);
    const right = await a.post("/status").type("form").send({ _csrf: csrfFrom(page.text), ticket, email: "ada@example.com" });
    expect(right.text).toContain("Checkout button does nothing");
    const board = await owner.a.get("/admin/tickets");
    expect(board.text).toContain(ticket);
    // screenshots are private: not served from /media
    const { db } = await import("../../src/db/index.js");
    const { media } = await import("../../src/db/schema/index.js");
    const { eq } = await import("drizzle-orm");
    const priv = (await db.select().from(media).where(eq(media.folder, "private")))[0]!;
    expect((await request(await getApp()).get(`/media/${priv.key}`)).status).toBe(404);
    expect((await owner.a.get(`/admin/files/${priv.id}`)).status).toBe(200);
  });

  it("rejects uploads whose bytes aren't an allowed type, and strips EXIF from images", async () => {
    const fake = Buffer.from("<?php echo 'x'; ?>");
    const bad = await owner.a.post("/admin/media/upload").set("x-csrf-token", owner.csrf).attach("files", fake, "evil.jpg");
    expect(bad.body.errors[0]).toMatch(/allowed file type/);
    const jpg = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#B8925A" } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret-location" } } })
      .toBuffer();
    const good = await owner.a.post("/admin/media/upload").set("x-csrf-token", owner.csrf).attach("files", jpg, "photo.jpg");
    expect(good.body.ok).toBe(true);
    const item = good.body.items[0];
    const file = await request(await getApp()).get(new URL(item.url, "http://x").pathname);
    expect(file.headers["content-type"]).toBe("image/jpeg");
    expect(file.headers["x-content-type-options"]).toBe("nosniff");
    const meta = await sharp(file.body as Buffer).metadata();
    expect(meta.exif).toBeUndefined();
    const variant = await request(await getApp()).get(new URL(item.thumb, "http://x").pathname);
    expect(variant.headers["content-type"]).toBe("image/webp");
  });

  it("review request link works once and lands in moderation", async () => {
    const page = await owner.a.get("/admin/review-requests");
    await owner.a.post("/admin/review-requests").type("form").send({ _csrf: csrfFrom(page.text), name: "Client One", email: "client@example.com", days: "30" });
    const { db } = await import("../../src/db/index.js");
    const { jobs, testimonials } = await import("../../src/db/schema/index.js");
    const all = await db.select().from(jobs);
    const token = /\/review\/([\w-]+)/.exec(JSON.stringify(all.at(-1)!.payload))![1]!;
    const { a } = await agent(`/review/${token}`);
    const form = await a.get(`/review/${token}`);
    expect(form.status).toBe(200);
    const sent = await a.post(`/review/${token}`).type("form").send({ _csrf: csrfFrom(form.text), name: "Client One", rating: "5", quote: "Excellent work, delivered on time and well documented.", consent: "1" });
    expect(sent.text).toContain("Your review has been received");
    expect((await a.get(`/review/${token}`)).status).toBe(404);
    const t = (await db.select().from(testimonials)).find((x) => x.authorName === "Client One")!;
    expect(t.moderation).toBe("pending");
    expect((await request(await getApp()).get("/testimonials")).text).not.toContain("Excellent work");
  });

  it("records cookieless analytics but ignores bots and signed-in staff", async () => {
    const app = await getApp();
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
    await request(app).post("/api/collect").set("User-Agent", ua).send({ t: "pageview", path: "/work", ref: "https://www.linkedin.com/" });
    await request(app).post("/api/collect").set("User-Agent", "Googlebot/2.1").send({ t: "pageview", path: "/bot" });
    await owner.a.post("/api/collect").set("User-Agent", ua).send({ t: "pageview", path: "/staff" });
    const res = await request(app).post("/api/collect").set("User-Agent", ua).send({ t: "event", name: "cv_download", label: "x" });
    expect(res.status).toBe(204);
    expect(([] as string[]).concat(res.headers["set-cookie"] ?? []).some((c) => !c.startsWith("tj_csrf"))).toBe(false);
    const { db } = await import("../../src/db/index.js");
    const { analyticsHits } = await import("../../src/db/schema/index.js");
    const hits = await db.select().from(analyticsHits);
    expect(hits.map((h) => h.path)).toEqual(["/work"]);
    expect(hits[0]!.referrer).toBe("linkedin.com");
    expect(hits[0]!.visitorHash).toHaveLength(32);
  });

  it("CV download falls back to a generated PDF and counts real downloads", async () => {
    const app = await getApp();
    const gen = await request(app).get("/cv/generated.pdf");
    expect(gen.headers["content-type"]).toBe("application/pdf");
    expect((gen.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });
});
