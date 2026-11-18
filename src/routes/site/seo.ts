import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { appUrl, env } from "../../config/env.js";
import * as Q from "../../server/public.js";
import { getSettings } from "../../server/settings.js";
import { escapeHtml, truncate } from "../../lib/util.js";
import { cached } from "../../lib/cache.js";
import { logger } from "../../lib/logger.js";
import { h } from "./router.js";

export const seoRouter = Router();
const xml = (s: unknown) => escapeHtml(s);

seoRouter.get("/robots.txt", (_req, res) => {
  res.type("text/plain").set("Cache-Control", "public, max-age=3600").send(
    [
      "User-agent: *",
      "Allow: /",
      `Disallow: /${env.ADMIN_PATH}/`,
      "Disallow: /setup",
      "Disallow: /review/",
      "Disallow: /status",
      "Disallow: /api/",
      "",
      `Sitemap: ${appUrl}/sitemap.xml`,
      "",
    ].join("\n"),
  );
});

seoRouter.get("/sitemap.xml", h(async (_req, res) => {
  const body = await cached("sitemap", ["all"], async () => {
    const [projects, trainings, posts, services, certs, albums] = await Promise.all([Q.getProjects(), Q.getTrainings(), Q.getPosts(), Q.getServices(), Q.getCertifications(), Q.getAlbums()]);
    const { db } = await import("../../db/index.js");
    const s = await import("../../db/schema/index.js");
    const { live } = Q;
    const pages = await db.select({ slug: s.pages.slug, updatedAt: s.pages.updatedAt }).from(s.pages).where(live(s.pages));
    const urls: Array<[string, Date | null | undefined, string]> = [
      ["/", null, "1.0"],
      ...["/about", "/services", "/work", "/training", "/courses", "/certifications", "/gallery", "/testimonials", "/insights", "/resume", "/contact", "/maintenance-request"].map((p) => [p, null, "0.8"] as [string, null, string]),
      ...services.map((x) => [`/services/${x.slug}`, x.updatedAt, "0.8"] as [string, Date, string]),
      ...projects.map((x) => [`/work/${x.slug}`, x.publishedAt, "0.7"] as [string, Date | null, string]),
      ...trainings.map((x) => [`/training/${x.slug}`, null, "0.7"] as [string, null, string]),
      ...posts.map((x) => [`/insights/${x.slug}`, x.publishedAt, "0.7"] as [string, Date | null, string]),
      ...certs.map((x) => [`/certifications/${x.slug}`, x.updatedAt, "0.5"] as [string, Date, string]),
      ...albums.map((x) => [`/gallery/${x.slug}`, x.updatedAt, "0.5"] as [string, Date, string]),
      ...pages.map((x) => [`/${x.slug}`, x.updatedAt, "0.5"] as [string, Date, string]),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(([loc, mod, pr]) => `  <url><loc>${xml(appUrl + loc)}</loc>${mod ? `<lastmod>${new Date(mod).toISOString().slice(0, 10)}</lastmod>` : ""}<priority>${pr}</priority></url>`)
      .join("\n")}\n</urlset>\n`;
  });
  res.type("application/xml").set("Cache-Control", "public, max-age=900").send(body);
}));

seoRouter.get("/rss.xml", h(async (_req, res) => {
  const [posts, s] = await Promise.all([Q.getPosts(), getSettings()]);
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${xml(p.title)}</title>
    <link>${appUrl}/insights/${xml(p.slug)}</link>
    <guid isPermaLink="true">${appUrl}/insights/${xml(p.slug)}</guid>
    ${p.publishedAt ? `<pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>` : ""}
    ${p.category ? `<category>${xml(p.category.name)}</category>` : ""}
    <description>${xml(p.excerpt ?? "")}</description>
  </item>`,
    )
    .join("\n");
  res.type("application/rss+xml").set("Cache-Control", "public, max-age=900").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Insights — ${xml(s.profile.fullName)}</title>
  <link>${appUrl}/insights</link>
  <atom:link href="${appUrl}/rss.xml" rel="self" type="application/rss+xml"/>
  <description>${xml(truncate(s.seo.defaultDescription, 300))}</description>
  <language>en</language>
${items}
</channel>
</rss>
`);
}));

seoRouter.get("/manifest.webmanifest", h(async (_req, res) => {
  const s = await getSettings();
  res.type("application/manifest+json").json({
    name: s.seo.siteName,
    short_name: "TJ",
    description: s.profile.headline,
    start_url: "/",
    display: "standalone",
    background_color: "#F8F6F1",
    theme_color: "#0F2A47",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  });
}));

// ── Dynamic Open Graph images (satori → SVG → sharp → PNG) ────────────────────────────────────────
let fonts: Array<{ name: string; data: Buffer; weight: 400 | 600; style: "normal" | "italic" }> | null = null;
async function loadFonts() {
  if (fonts) return fonts;
  const f = (pkg: string, file: string) => fs.readFile(path.resolve(process.cwd(), "node_modules", pkg, "files", file));
  fonts = [
    { name: "Fraunces", data: await f("@fontsource/fraunces", "fraunces-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Fraunces", data: await f("@fontsource/fraunces", "fraunces-latin-400-italic.woff"), weight: 400, style: "italic" },
    { name: "Inter", data: await f("@fontsource/inter", "inter-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Inter", data: await f("@fontsource/inter", "inter-latin-600-normal.woff"), weight: 600, style: "normal" },
  ];
  return fonts;
}

type Node = { type: string; props: Record<string, unknown> };
const el = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });

export async function renderOg(title: string, kicker: string, name: string, headline: string): Promise<Buffer> {
  const { default: satori } = await import("satori");
  const sharp = (await import("sharp")).default;
  const tree = el(
    "div",
    { width: 1200, height: 630, display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0F2A47", padding: "64px 72px", fontFamily: "Inter", color: "#F3EFE6" },
    [
      el("div", { display: "flex", alignItems: "center", gap: 18 }, [
        el("div", { width: 56, height: 56, borderRadius: 28, border: "2px solid #B8925A", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Fraunces", fontWeight: 600, fontSize: 22 }, "TB"),
        el("div", { fontFamily: "Fraunces", fontWeight: 600, fontSize: 28 }, name),
      ]),
      el("div", { display: "flex", flexDirection: "column", gap: 22 }, [
        el("div", { display: "flex", alignItems: "center", gap: 16, color: "#CFAE74", fontSize: 22, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase" }, [el("div", { width: 48, height: 2, background: "#B8925A" }), kicker]),
        el("div", { fontFamily: "Fraunces", fontWeight: 600, fontSize: title.length > 60 ? 54 : 68, lineHeight: 1.08, maxWidth: 1000 }, title),
      ]),
      el("div", { display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 22, color: "#c9d2de" }, [
        el("div", { fontFamily: "Fraunces", fontStyle: "italic", fontSize: 26, maxWidth: 860 }, headline),
        el("div", { width: 120, height: 4, background: "#B8925A" }),
      ]),
    ],
  );
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts: await loadFonts() });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

seoRouter.get("/og/page.png", h(async (req, res) => {
  const s = await getSettings();
  const title = truncate(String(req.query.title ?? s.profile.fullName), 110);
  const kicker = truncate(String(req.query.kicker ?? "Tijani Bulama"), 40);
  try {
    const png = await cached(`og:${title}:${kicker}`, ["og"], () => renderOg(title, kicker, s.profile.fullName, truncate(s.profile.positioning, 90)), 24 * 3600e3);
    res.type("image/png").set("Cache-Control", "public, max-age=86400").send(png);
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "og render failed");
    res.redirect("/favicon.svg");
  }
}));
