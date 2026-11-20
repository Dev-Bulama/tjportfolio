import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { can } from "../../src/lib/permissions.js";
import { sniff } from "../../src/lib/magic.js";
import { contrastRatio } from "../../src/lib/color.js";
import { toCsv } from "../../src/lib/csv.js";
import { passwordProblems } from "../../src/lib/auth/password.js";
import { makeRecoveryCodes, normalizeRecovery } from "../../src/lib/auth/totp.js";
import { isBot, parseUA, referrerDomain, visitorHash } from "../../src/server/analytics.js";
import { LocalStorage } from "../../src/lib/storage/local.js";
import { embedUrl } from "../../src/resources/blocks.js";
import { validate } from "../../src/resources/engine.js";
import { RESOURCES } from "../../src/resources/registry.js";
import { parse, email, optUrl, z } from "../../src/lib/validation.js";
import { decrypt, encrypt } from "../../src/lib/crypto.js";

describe("permissions", () => {
  it("implements the role matrix", () => {
    expect(can({ role: "owner" }, "manage", "users")).toBe(true);
    expect(can({ role: "admin" }, "update", "settings")).toBe(true);
    expect(can({ role: "admin" }, "manage", "users")).toBe(false);
    expect(can({ role: "editor" }, "publish", "content")).toBe(true);
    expect(can({ role: "editor" }, "view", "inbox")).toBe(false);
    expect(can({ role: "viewer" }, "view", "content")).toBe(true);
    expect(can({ role: "viewer" }, "update", "content")).toBe(false);
    expect(can(null, "view", "content")).toBe(false);
  });
});

describe("magic bytes", () => {
  it("detects real types regardless of extension", () => {
    expect(sniff(Buffer.from("ffd8ffe000104a4649460001", "hex"))?.mime).toBe("image/jpeg");
    expect(sniff(Buffer.from("89504e470d0a1a0a0000000d", "hex"))?.mime).toBe("image/png");
    expect(sniff(Buffer.from("%PDF-1.7\n%âãÏÓ", "latin1"))?.mime).toBe("application/pdf");
    expect(sniff(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(sniff(Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00", "latin1"))).toBeNull();
  });
});

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrastRatio("#0B1A2B", "#F8F6F1")).toBeGreaterThan(15);
    expect(contrastRatio("#5F6A78", "#F8F6F1")).toBeGreaterThan(4.5); // muted text passes AA
    expect(contrastRatio("#8A6A3A", "#F8F6F1")).toBeGreaterThan(4.5); // gold-ink passes AA
  });
});

describe("csv", () => {
  it("quotes and neutralises formulas", () => {
    const out = toCsv([{ a: 'x,"y"', b: "=HYPERLINK()" }], [["a", "A"], ["b", "B"]]);
    expect(out).toBe('A,B\r\n"x,""y""",\'=HYPERLINK()\r\n');
  });
});

describe("passwords & 2FA", () => {
  it("enforces the password policy", () => {
    expect(passwordProblems("short")).not.toHaveLength(0);
    expect(passwordProblems("password123")).not.toHaveLength(0);
    expect(passwordProblems("alllowercaseletters")).not.toHaveLength(0);
    expect(passwordProblems("tijani-Strong-Pass-9", { email: "tijani@example.com" })).toContain("Don't include your email address.");
    expect(passwordProblems("Correct-Horse-Battery-9")).toHaveLength(0);
  });
  it("makes 10 unique recovery codes", () => {
    const codes = makeRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes.map((c) => c.code)).size).toBe(10);
    expect(codes[0]!.code).toMatch(/^[a-z0-9x]{4}-[a-z0-9x]{4}-[a-z0-9x]{4}$/);
    expect(normalizeRecovery("  ABCD-EFGH ")).toBe("abcd-efgh");
  });
  it("encrypts TOTP secrets at rest", () => {
    const c = encrypt("JBSWY3DPEHPK3PXP");
    expect(c).not.toContain("JBSWY3DP");
    expect(decrypt(c)).toBe("JBSWY3DPEHPK3PXP");
  });
});

describe("analytics helpers", () => {
  it("hashes visitors with a daily-rotating salt", () => {
    const a = visitorHash("1.2.3.4", "UA", "2026-01-01");
    expect(a).toBe(visitorHash("1.2.3.4", "UA", "2026-01-01"));
    expect(a).not.toBe(visitorHash("1.2.3.4", "UA", "2026-01-02"));
    expect(a).not.toContain("1.2.3.4");
    expect(a).toHaveLength(32);
  });
  it("detects bots and parses user agents", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1")).toBe(false);
    expect(parseUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari")).toEqual({ device: "mobile", browser: "Safari", os: "iOS" });
    expect(parseUA("Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537 Edg/130").browser).toBe("Edge");
  });
  it("keeps only external referrer domains", () => {
    expect(referrerDomain("https://www.linkedin.com/feed/", "example.com")).toBe("linkedin.com");
    expect(referrerDomain("https://example.com/work", "example.com")).toBeNull();
    expect(referrerDomain("not a url", "example.com")).toBeNull();
  });
});

describe("local storage driver", () => {
  it("writes, reads and refuses path traversal", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "tj-store-"));
    const d = new LocalStorage(dir);
    await d.put("2026/11/a.txt", Buffer.from("hello"), "text/plain");
    expect((await d.getBuffer("2026/11/a.txt"))?.toString()).toBe("hello");
    expect(await d.exists("2026/11/a.txt")).toBe(true);
    await expect(d.put("../escape.txt", Buffer.from("x"), "text/plain")).rejects.toThrow();
    await expect(d.put("/etc/passwd", Buffer.from("x"), "text/plain")).rejects.toThrow();
    await d.delete("2026/11/a.txt");
    expect(await d.exists("2026/11/a.txt")).toBe(false);
    expect((await d.health()).ok).toBe(true);
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe("embeds", () => {
  it("allows only known embed hosts", () => {
    expect(embedUrl("youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("youtube", "https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedUrl("calendly", "https://calendly.com/tj/30min")).toBe("https://calendly.com/tj/30min");
    expect(embedUrl("calendly", "https://evil.example/calendly.com")).toBeNull();
    expect(embedUrl("map", "javascript:alert(1)")).toBeNull();
  });
});

describe("validation schemas", () => {
  it("validates emails and urls", () => {
    expect(parse(z.object({ email }), { email: " TJ@Example.com " })).toEqual({ ok: true, data: { email: "tj@example.com" } });
    expect(parse(z.object({ email }), { email: "nope" }).ok).toBe(false);
    expect(parse(z.object({ u: optUrl }), { u: "ftp://x" }).ok).toBe(false);
    expect(parse(z.object({ u: optUrl }), { u: "" })).toEqual({ ok: true, data: { u: null } });
  });

  it("resource validation blocks placeholders and samples from going public", () => {
    const certs = RESOURCES.certifications!;
    const v = validate(certs, { name: "[[Certification name]]", slug: "x", issuer: "Oracle", status: "published", isSample: "1" });
    expect(v.errors.name).toMatch(/placeholder/i);
    expect(v.errors.isSample).toBeDefined();
    const ok = validate(certs, { name: "Oracle Database Administration Certified Professional", slug: "", issuer: "Oracle", status: "published", isSample: "0" });
    expect(ok.errors).toEqual({});
    expect(ok.main.slug).toBe("oracle-database-administration-certified-professional");
  });

  it("sanitizes rich text and children on save", () => {
    const projects = RESOURCES.projects!;
    const v = validate(projects, {
      title: "X",
      slug: "x",
      status: "draft",
      bodyHtml: '<p>ok<script>alert(1)</script></p><img src="x" onerror="alert(1)">',
      metrics: JSON.stringify([{ label: "<b>Speed</b>", value: "2x" }, { label: "", value: "" }]),
    });
    expect(String(v.main.bodyHtml)).not.toMatch(/script|onerror/);
    expect(v.extra.metrics).toEqual([{ label: "Speed", value: "2x" }]);
  });

  it("requires a publish date for scheduled items and reserves system paths for pages", () => {
    expect(validate(RESOURCES.posts!, { title: "A", slug: "a", status: "scheduled", bodyHtml: "<p>x</p>" }).errors.publishedAt).toBeDefined();
    expect(validate(RESOURCES.pages!, { title: "Admin", slug: "admin/x", status: "draft" }).errors.slug).toMatch(/reserved/);
  });
});

describe("env placeholders", () => {
  it("treats 'none' and friends as unset for optional variables", async () => {
    const { UNSET } = await import("../../src/config/env.js");
    for (const v of ["none", "NONE", "off", "disabled", "-", "null", "false"]) expect(UNSET.test(v)).toBe(true);
    expect(UNSET.test("https://bucket.example.com")).toBe(false);
  });
});
