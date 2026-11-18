import type { Request, Response } from "express";
import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { siteRouter, h } from "./router.js";
import { db } from "../../db/index.js";
import { cvFiles, media } from "../../db/schema/index.js";
import { driver } from "../../lib/storage/index.js";
import { can } from "../../lib/permissions.js";
import { bust } from "../../lib/cache.js";
import { sanitizeRich, stripPlaceholders } from "../../lib/sanitize.js";
import { embedUrl } from "../../resources/blocks.js";
import { generateCvPdf } from "../../server/cv-pdf.js";
import { trackEvent } from "../../server/analytics.js";
import { mediaMap } from "../../server/media.js";
import { breadcrumbLd } from "../../server/seo.js";
import * as Q from "../../server/public.js";
import type { Settings } from "../../server/settings.js";

// ── CV downloads (counted) ────────────────────────────────────────────────────────────────────────
async function sendCv(req: Request, res: Response, id?: number) {
  const where = and(isNull(cvFiles.deletedAt), eq(cvFiles.status, "published"), isNotNull(cvFiles.mediaId), id ? eq(cvFiles.id, id) : eq(cvFiles.isPrimary, true));
  let cv = (await db.select().from(cvFiles).where(where).limit(1))[0];
  if (!cv && !id) cv = (await db.select().from(cvFiles).where(and(isNull(cvFiles.deletedAt), eq(cvFiles.status, "published"), isNotNull(cvFiles.mediaId))).limit(1))[0];
  if (!cv) return res.redirect("/cv/generated.pdf");
  const m = (await db.select().from(media).where(eq(media.id, cv.mediaId!)))[0];
  const obj = m ? await driver(m.driver).get(m.key) : null;
  if (!m || !obj) return res.redirect("/cv/generated.pdf");
  await db.update(cvFiles).set({ downloads: sql`${cvFiles.downloads} + 1` }).where(eq(cvFiles.id, cv.id));
  bust("cv");
  await trackEvent(req, "cv_download", cv.title, "/resume");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${cv.title.replace(/[^\w.-]+/g, "-")}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
  obj.body.pipe(res);
}
siteRouter.get("/cv", h((req, res) => sendCv(req, res)));
siteRouter.get("/cv/generated.pdf", h(async (req, res) => {
  const pdf = await generateCvPdf();
  await trackEvent(req, "cv_download", "generated", "/resume");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.inline === "1" ? "inline" : "attachment"}; filename="Tijani-Bulama-CV.pdf"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(pdf);
}));
siteRouter.get("/cv/:id", h(async (req, res, next) => {
  if (!/^\d+$/.test(String(req.params.id))) return next();
  await sendCv(req, res, Number(req.params.id));
}));

// ── Custom pages (page builder) ───────────────────────────────────────────────────────────────────
type Block = { type: string; data: Record<string, unknown> };

/** Loads whatever each block needs (cards, gallery, stats, FAQ…) so templates stay dumb. */
async function prepareBlocks(blocks: Block[]) {
  const ids = blocks.map((b) => Number(b.data.imageId)).filter((n) => n > 0);
  const imgs = await mediaMap(ids);
  return Promise.all(
    blocks.map(async (b) => {
      const d = b.data;
      const out: Record<string, unknown> = { type: b.type, d, image: d.imageId ? imgs.get(Number(d.imageId)) : undefined };
      if (b.type === "richtext" || b.type === "imageText") out.html = stripPlaceholders(sanitizeRich(String(d.html ?? "")));
      if (b.type === "stats") out.stats = await Q.getStats();
      if (b.type === "faq") {
        const cats = await Q.getCategories("faq");
        const cat = cats.find((c) => c.slug === d.category);
        out.faqs = (await Q.getFaqs()).filter((f) => !cat || f.categoryId === cat.id);
      }
      if (b.type === "gallery") {
        const album = d.albumSlug ? await Q.getAlbum(String(d.albumSlug)) : null;
        out.images = album ? album.images.slice(0, Number(d.limit) || 9) : [];
      }
      if (b.type === "embed") out.src = d.url ? embedUrl(String(d.kind), String(d.url)) : null;
      if (b.type === "cards") {
        const limit = Number(d.limit) || 6;
        const cat = String(d.category ?? "");
        const feat = Boolean(d.featuredOnly);
        let items: unknown[] = [];
        if (d.source === "projects") items = (await Q.getProjects()).filter((p) => (!cat || p.category?.slug === cat) && (!feat || p.featured));
        if (d.source === "trainings") items = (await Q.getTrainings()).filter((t) => (!cat || t.track?.slug === cat) && (!feat || t.featured));
        if (d.source === "certifications") items = (await Q.getCertifications()).filter((c) => (!cat || c.category?.slug === cat) && (!feat || c.featured));
        if (d.source === "testimonials") items = (await Q.getTestimonials()).filter((r) => (!cat || r.serviceType?.slug === cat) && (!feat || r.featured));
        if (d.source === "posts") items = (await Q.getPosts()).filter((p) => (!cat || p.category?.slug === cat) && (!feat || p.featured));
        out.items = items.slice(0, limit);
      }
      return out;
    }),
  );
}

siteRouter.get(/^\/([a-z0-9-]+(?:\/[a-z0-9-]+)*)\/?$/, h(async (req, res, next) => {
  const slug = (req.params as unknown as string[])[0]!;
  const preview = req.query.preview === "1" && can(req.user, "view", "content");
  const page = await Q.getPage(slug, preview);
  if (!page) return next();
  const blocks = await prepareBlocks(page.blocks.map((b) => ({ type: b.type, data: b.data })));
  const first = blocks[0]?.d as Record<string, unknown> | undefined;
  const ogMap = await mediaMap([page.ogImageId]);
  const s = res.locals.settings as Settings;
  await res.page("site/page", {
    page,
    blocks,
    meta: (res.locals.resolveMeta as (m: object, i?: unknown) => unknown)(
      {
        title: page.seoTitle || page.title,
        description: page.seoDescription || (first?.subtitle as string) || s.seo.defaultDescription,
        noindex: page.status === "draft",
        jsonLd: [breadcrumbLd([["Home", "/"], [page.title, `/${page.slug}`]])],
      },
      page.ogImageId ? ogMap.get(page.ogImageId) : null,
    ),
  });
}));
