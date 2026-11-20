/**
 * Public data loaders. Everything here is cached by tag (PLAN D2) and filters out drafts,
 * future-scheduled items, soft-deleted rows and sample content (brief §0.4).
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { MySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "../db/index.js";
import * as s from "../db/schema/index.js";
import { cached } from "../lib/cache.js";
import { isPlaceholder, pub, safeUrl } from "../lib/util.js";
import { sanitizeRich as sanitizeRaw, stripPlaceholders } from "../lib/sanitize.js";
const sanitizeRich = (h: string | null | undefined): string => stripPlaceholders(sanitizeRaw(h));
import { mediaMap, type Img } from "./media.js";

type Live = { status: MySqlColumn; publishedAt: MySqlColumn; deletedAt: MySqlColumn; isSample: MySqlColumn };

/** Published (or scheduled and due), not deleted, not sample. */
export function live(t: Live, preview = false): SQL {
  if (preview) return and(isNull(t.deletedAt))!;
  return and(
    isNull(t.deletedAt),
    eq(t.isSample, false),
    or(eq(t.status, "published"), and(eq(t.status, "scheduled"), lte(t.publishedAt, sql`NOW()`))),
  )!;
}

export type Category = { id: number; name: string; slug: string; type: string };
export async function getCategories(type: (typeof s.CATEGORY_TYPES)[number]): Promise<Category[]> {
  return cached(`cats:${type}`, ["categories"], () =>
    db
      .select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug, type: s.categories.type })
      .from(s.categories)
      .where(and(eq(s.categories.type, type), isNull(s.categories.deletedAt), eq(s.categories.status, "published")))
      .orderBy(asc(s.categories.sortOrder), asc(s.categories.name)),
  );
}

export type MenuItem = { id: number; label: string; href: string; newTab: boolean; children: MenuItem[] };
export async function getMenu(key: string): Promise<MenuItem[]> {
  return cached(`menu:${key}`, ["menus"], async () => {
    const m = (await db.select().from(s.menus).where(eq(s.menus.key, key)))[0];
    if (!m) return [];
    const items = await db
      .select()
      .from(s.menuItems)
      .where(and(eq(s.menuItems.menuId, m.id), eq(s.menuItems.visible, true)))
      .orderBy(asc(s.menuItems.sortOrder));
    const byId = new Map<number, MenuItem>(items.map((i) => [i.id, { id: i.id, label: i.label, href: i.href, newTab: i.newTab, children: [] }]));
    const roots: MenuItem[] = [];
    for (const i of items) {
      const node = byId.get(i.id)!;
      if (i.parentId && byId.has(i.parentId)) byId.get(i.parentId)!.children.push(node);
      else roots.push(node);
    }
    return roots;
  });
}

export async function getSocials() {
  return cached("socials", ["socials"], async () => {
    const rows = await db.select().from(s.socialLinks).where(live(s.socialLinks)).orderBy(asc(s.socialLinks.sortOrder));
    return rows
      .map((r) => ({ ...r, url: safeUrl(r.url) }))
      .filter((r): r is typeof r & { url: string } => Boolean(r.url));
  });
}

export async function getStats() {
  return cached("stats", ["stats"], async () =>
    (await db.select().from(s.stats).where(live(s.stats)).orderBy(asc(s.stats.sortOrder))).filter((r) => r.value > 0),
  );
}

export async function getHomeSections() {
  return cached("home-sections", ["homepage"], () =>
    db.select().from(s.homepageSections).where(live(s.homepageSections)).orderBy(asc(s.homepageSections.sortOrder)),
  );
}

async function categoryMap(): Promise<Map<number, Category>> {
  return cached("cats:all", ["categories"], async () => {
    const rows = await db
      .select({ id: s.categories.id, name: s.categories.name, slug: s.categories.slug, type: s.categories.type })
      .from(s.categories)
      .where(isNull(s.categories.deletedAt));
    return new Map(rows.map((r) => [r.id, r]));
  });
}

// ── Services ──────────────────────────────────────────────────────────────────────────────────────
export async function getServices() {
  return cached("services", ["services", "media"], async () => {
    const rows = await db.select().from(s.services).where(live(s.services)).orderBy(asc(s.services.sortOrder));
    return rows;
  });
}
export async function getService(slug: string, preview = false) {
  const load = async () => {
    const row = (await db.select().from(s.services).where(and(eq(s.services.slug, slug), live(s.services, preview))))[0];
    if (!row) return null;
    const faqs = await db.select().from(s.serviceFaqs).where(eq(s.serviceFaqs.serviceId, row.id)).orderBy(asc(s.serviceFaqs.sortOrder));
    const catIds = row.projectCategoryIds ?? [];
    const projects = catIds.length ? (await getProjects()).filter((p) => p.categoryId && catIds.includes(p.categoryId)).slice(0, 6) : [];
    const reviews = row.serviceTypeId ? (await getTestimonials()).filter((t) => t.serviceTypeId === row.serviceTypeId).slice(0, 6) : [];
    const media = await mediaMap([row.ogImageId]);
    return { ...row, bodyHtml: sanitizeRich(row.bodyHtml), faqs, projects, reviews, ogImage: row.ogImageId ? media.get(row.ogImageId) : undefined };
  };
  return preview ? load() : cached(`service:${slug}`, ["services", "projects", "testimonials", "media"], load);
}

// ── Projects ──────────────────────────────────────────────────────────────────────────────────────
export type ProjectCard = Awaited<ReturnType<typeof getProjects>>[number];
export async function getProjects() {
  return cached("projects", ["projects", "media", "categories", "skills"], async () => {
    const rows = await db
      .select({
        id: s.projects.id,
        title: s.projects.title,
        slug: s.projects.slug,
        summary: s.projects.summary,
        categoryId: s.projects.categoryId,
        clientName: s.projects.clientName,
        showClient: s.projects.showClient,
        year: s.projects.year,
        projectStatus: s.projects.projectStatus,
        coverId: s.projects.coverId,
        featured: s.projects.featured,
        sortOrder: s.projects.sortOrder,
        publishedAt: s.projects.publishedAt,
      })
      .from(s.projects)
      .where(live(s.projects))
      .orderBy(asc(s.projects.sortOrder), desc(s.projects.publishedAt));
    const cats = await categoryMap();
    const media = await mediaMap(rows.map((r) => r.coverId));
    const skillRows = rows.length
      ? await db
          .select({ projectId: s.projectSkills.projectId, name: s.skills.name })
          .from(s.projectSkills)
          .innerJoin(s.skills, eq(s.skills.id, s.projectSkills.skillId))
          .where(inArray(s.projectSkills.projectId, rows.map((r) => r.id)))
          .orderBy(asc(s.projectSkills.sortOrder))
      : [];
    return rows.map((r) => ({
      ...r,
      category: r.categoryId ? cats.get(r.categoryId) : undefined,
      cover: r.coverId ? media.get(r.coverId) : undefined,
      client: r.showClient ? pub(r.clientName) : undefined,
      tech: skillRows.filter((k) => k.projectId === r.id).map((k) => k.name),
    }));
  });
}

export async function getProject(slug: string, preview = false) {
  const load = async () => {
    const row = (await db.select().from(s.projects).where(and(eq(s.projects.slug, slug), live(s.projects, preview))))[0];
    if (!row) return null;
    const [images, metrics, tech] = await Promise.all([
      db.select().from(s.projectImages).where(eq(s.projectImages.projectId, row.id)).orderBy(asc(s.projectImages.sortOrder)),
      db.select().from(s.projectMetrics).where(eq(s.projectMetrics.projectId, row.id)).orderBy(asc(s.projectMetrics.sortOrder)),
      db
        .select({ name: s.skills.name })
        .from(s.projectSkills)
        .innerJoin(s.skills, eq(s.skills.id, s.projectSkills.skillId))
        .where(eq(s.projectSkills.projectId, row.id))
        .orderBy(asc(s.projectSkills.sortOrder)),
    ]);
    const media = await mediaMap([row.coverId, row.clientLogoId, row.ogImageId, ...images.map((i) => i.mediaId)]);
    const cats = await categoryMap();
    const all = await getProjects();
    const idx = all.findIndex((p) => p.id === row.id);
    const reviews = (await getTestimonials()).filter((t) => t.projectId === row.id);
    return {
      ...row,
      bodyHtml: sanitizeRich(row.bodyHtml),
      category: row.categoryId ? cats.get(row.categoryId) : undefined,
      cover: row.coverId ? media.get(row.coverId) : undefined,
      clientLogo: row.clientLogoId ? media.get(row.clientLogoId) : undefined,
      ogImage: row.ogImageId ? media.get(row.ogImageId) : undefined,
      client: row.showClient ? pub(row.clientName) : undefined,
      gallery: images.map((i) => ({ ...i, media: media.get(i.mediaId) })).filter((i): i is typeof i & { media: Img } => Boolean(i.media)),
      metrics: metrics.filter((m) => !isPlaceholder(m.value) && !isPlaceholder(m.label)),
      tech: tech.map((t) => t.name),
      prev: idx > 0 ? all[idx - 1] : undefined,
      next: idx >= 0 && idx < all.length - 1 ? all[idx + 1] : undefined,
      reviews,
    };
  };
  return preview ? load() : cached(`project:${slug}`, ["projects", "media", "testimonials", "skills"], load);
}

// ── Trainings ─────────────────────────────────────────────────────────────────────────────────────
export async function getTrainings() {
  return cached("trainings", ["trainings", "media", "categories"], async () => {
    const rows = await db
      .select({
        id: s.trainings.id,
        title: s.trainings.title,
        slug: s.trainings.slug,
        summary: s.trainings.summary,
        trackId: s.trainings.trackId,
        clientName: s.trainings.clientName,
        showClient: s.trainings.showClient,
        format: s.trainings.format,
        location: s.trainings.location,
        durationLabel: s.trainings.durationLabel,
        participants: s.trainings.participants,
        startDate: s.trainings.startDate,
        endDate: s.trainings.endDate,
        coverId: s.trainings.coverId,
        featured: s.trainings.featured,
      })
      .from(s.trainings)
      .where(live(s.trainings))
      .orderBy(asc(s.trainings.sortOrder), desc(s.trainings.startDate));
    const cats = await categoryMap();
    const media = await mediaMap(rows.map((r) => r.coverId));
    return rows.map((r) => ({
      ...r,
      track: r.trackId ? cats.get(r.trackId) : undefined,
      cover: r.coverId ? media.get(r.coverId) : undefined,
      client: r.showClient ? pub(r.clientName) : undefined,
      durationLabel: pub(r.durationLabel),
      location: pub(r.location),
    }));
  });
}

export async function getTraining(slug: string, preview = false) {
  const load = async () => {
    const row = (await db.select().from(s.trainings).where(and(eq(s.trainings.slug, slug), live(s.trainings, preview))))[0];
    if (!row) return null;
    const [modules, images] = await Promise.all([
      db.select().from(s.trainingModules).where(eq(s.trainingModules.trainingId, row.id)).orderBy(asc(s.trainingModules.sortOrder)),
      db.select().from(s.trainingImages).where(eq(s.trainingImages.trainingId, row.id)).orderBy(asc(s.trainingImages.sortOrder)),
    ]);
    const media = await mediaMap([row.coverId, row.ogImageId, ...images.map((i) => i.mediaId)]);
    const cats = await categoryMap();
    const certIds = row.relatedCertificationIds ?? [];
    const certs = certIds.length ? (await getCertifications()).filter((c) => certIds.includes(c.id)) : [];
    const reviews = (await getTestimonials()).filter((t) => t.trainingId === row.id);
    return {
      ...row,
      bodyHtml: sanitizeRich(row.bodyHtml),
      track: row.trackId ? cats.get(row.trackId) : undefined,
      cover: row.coverId ? media.get(row.coverId) : undefined,
      ogImage: row.ogImageId ? media.get(row.ogImageId) : undefined,
      client: row.showClient ? pub(row.clientName) : undefined,
      durationLabel: pub(row.durationLabel),
      location: pub(row.location),
      modules,
      gallery: images.map((i) => ({ ...i, media: media.get(i.mediaId) })).filter((i): i is typeof i & { media: Img } => Boolean(i.media)),
      outcomes: (row.outcomes ?? []).filter((o) => !isPlaceholder(o)),
      certs,
      reviews,
    };
  };
  return preview ? load() : cached(`training:${slug}`, ["trainings", "media", "testimonials", "certifications"], load);
}

// ── Courses ───────────────────────────────────────────────────────────────────────────────────────
export async function getCourses() {
  return cached("courses", ["courses", "media", "categories"], async () => {
    const rows = await db.select().from(s.courses).where(live(s.courses)).orderBy(asc(s.courses.sortOrder), asc(s.courses.startDate));
    const cats = await categoryMap();
    const media = await mediaMap(rows.map((r) => r.coverId));
    return rows.map((r) => ({ ...r, bodyHtml: sanitizeRich(r.bodyHtml), track: r.trackId ? cats.get(r.trackId) : undefined, cover: r.coverId ? media.get(r.coverId) : undefined }));
  });
}

// ── Certifications ────────────────────────────────────────────────────────────────────────────────
export async function getCertifications() {
  return cached("certifications", ["certifications", "media", "categories"], async () => {
    const rows = await db.select().from(s.certifications).where(live(s.certifications)).orderBy(asc(s.certifications.sortOrder), desc(s.certifications.issueDate));
    const cats = await categoryMap();
    const media = await mediaMap(rows.flatMap((r) => [r.issuerLogoId, r.fileId]));
    return rows
      .filter((r) => !isPlaceholder(r.name) && !isPlaceholder(r.issuer))
      .map((r) => ({
        ...r,
        verifyUrl: safeUrl(r.verifyUrl),
        credentialId: pub(r.credentialId),
        category: r.categoryId ? cats.get(r.categoryId) : undefined,
        logo: r.issuerLogoId ? media.get(r.issuerLogoId) : undefined,
        file: r.fileId ? media.get(r.fileId) : undefined,
      }));
  });
}
export async function getCertification(slug: string) {
  return (await getCertifications()).find((c) => c.slug === slug) ?? null;
}

// ── Testimonials ──────────────────────────────────────────────────────────────────────────────────
export type Review = Awaited<ReturnType<typeof getTestimonials>>[number];
export async function getTestimonials() {
  return cached("testimonials", ["testimonials", "media", "categories", "projects"], async () => {
    const rows = await db
      .select()
      .from(s.testimonials)
      .where(
        and(
          isNull(s.testimonials.deletedAt),
          eq(s.testimonials.isSample, false),
          eq(s.testimonials.consent, true),
          eq(s.testimonials.moderation, "approved"),
        ),
      )
      .orderBy(desc(s.testimonials.featured), asc(s.testimonials.sortOrder), desc(s.testimonials.date));
    const cats = await categoryMap();
    const media = await mediaMap(rows.flatMap((r) => [r.authorPhotoId, r.companyLogoId]));
    const projectRows = rows.some((r) => r.projectId)
      ? await db.select({ id: s.projects.id, title: s.projects.title, slug: s.projects.slug }).from(s.projects).where(and(live(s.projects), inArray(s.projects.id, rows.map((r) => r.projectId ?? 0))))
      : [];
    return rows.map((r) => ({
      ...r,
      authorRole: pub(r.authorRole),
      company: pub(r.company),
      serviceType: r.serviceTypeId ? cats.get(r.serviceTypeId) : undefined,
      photo: r.authorPhotoId ? media.get(r.authorPhotoId) : undefined,
      logo: r.companyLogoId ? media.get(r.companyLogoId) : undefined,
      project: projectRows.find((p) => p.id === r.projectId),
    }));
  });
}

// ── Posts ─────────────────────────────────────────────────────────────────────────────────────────
export async function getPosts() {
  return cached("posts", ["posts", "media", "categories"], async () => {
    const rows = await db
      .select({
        id: s.posts.id,
        title: s.posts.title,
        slug: s.posts.slug,
        excerpt: s.posts.excerpt,
        coverId: s.posts.coverId,
        categoryId: s.posts.categoryId,
        readingMinutes: s.posts.readingMinutes,
        publishedAt: s.posts.publishedAt,
        featured: s.posts.featured,
      })
      .from(s.posts)
      .where(live(s.posts))
      .orderBy(desc(s.posts.publishedAt));
    const cats = await categoryMap();
    const media = await mediaMap(rows.map((r) => r.coverId));
    const tagRows = rows.length
      ? await db
          .select({ id: s.taggables.taggableId, name: s.tags.name, slug: s.tags.slug })
          .from(s.taggables)
          .innerJoin(s.tags, eq(s.tags.id, s.taggables.tagId))
          .where(and(eq(s.taggables.taggableType, "posts"), inArray(s.taggables.taggableId, rows.map((r) => r.id))))
      : [];
    return rows.map((r) => ({
      ...r,
      category: r.categoryId ? cats.get(r.categoryId) : undefined,
      cover: r.coverId ? media.get(r.coverId) : undefined,
      tags: tagRows.filter((t) => t.id === r.id).map(({ name, slug }) => ({ name, slug })),
    }));
  });
}

export async function getPost(slug: string, preview = false) {
  const load = async () => {
    const row = (await db.select().from(s.posts).where(and(eq(s.posts.slug, slug), live(s.posts, preview))))[0];
    if (!row) return null;
    const cats = await categoryMap();
    const media = await mediaMap([row.coverId, row.ogImageId]);
    const tagRows = await db
      .select({ name: s.tags.name, slug: s.tags.slug })
      .from(s.taggables)
      .innerJoin(s.tags, eq(s.tags.id, s.taggables.tagId))
      .where(and(eq(s.taggables.taggableType, "posts"), eq(s.taggables.taggableId, row.id)));
    const author = row.authorId ? (await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, row.authorId)))[0] : undefined;
    const all = await getPosts();
    const related = all
      .filter((p) => p.id !== row.id)
      .sort((a, b) => Number(b.categoryId === row.categoryId) - Number(a.categoryId === row.categoryId))
      .slice(0, 3);
    const { html, toc } = withToc(sanitizeRich(row.bodyHtml));
    return {
      ...row,
      bodyHtml: html,
      toc,
      category: row.categoryId ? cats.get(row.categoryId) : undefined,
      cover: row.coverId ? media.get(row.coverId) : undefined,
      ogImage: row.ogImageId ? media.get(row.ogImageId) : undefined,
      tags: tagRows,
      authorName: author?.name,
      related,
    };
  };
  return preview ? load() : cached(`post:${slug}`, ["posts", "media", "categories"], load);
}

/** Adds ids to h2/h3 headings and returns a table of contents. */
export function withToc(html: string): { html: string; toc: Array<{ id: string; text: string; level: number }> } {
  const toc: Array<{ id: string; text: string; level: number }> = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (_m, lvl: string, attrs: string | undefined, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    let id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
    while (used.has(id)) id += "-x";
    used.add(id);
    toc.push({ id, text, level: Number(lvl) });
    return `<h${lvl}${(attrs ?? "").replace(/\sid="[^"]*"/, "")} id="${id}">${inner}</h${lvl}>`;
  });
  return { html: out, toc };
}

// ── About page data ───────────────────────────────────────────────────────────────────────────────
export async function getAbout() {
  return cached("about", ["experiences", "education", "skills", "press", "media"], async () => {
    const [experiences, education, skills, press] = await Promise.all([
      db.select().from(s.experiences).where(live(s.experiences)).orderBy(asc(s.experiences.sortOrder)),
      db.select().from(s.education).where(live(s.education)).orderBy(asc(s.education.sortOrder)),
      db.select().from(s.skills).where(live(s.skills)).orderBy(asc(s.skills.sortOrder)),
      db.select().from(s.pressItems).where(live(s.pressItems)).orderBy(desc(s.pressItems.date)),
    ]);
    const media = await mediaMap([...experiences.map((e) => e.logoId), ...press.map((p) => p.imageId), ...skills.map((k) => k.iconId)]);
    return {
      experiences: experiences.map((e) => ({ ...e, logo: e.logoId ? media.get(e.logoId) : undefined, periodLabel: pub(e.periodLabel), location: pub(e.location) })),
      education: education.filter((e) => !isPlaceholder(e.institution)),
      skills: skills.map((k) => ({ ...k, iconImg: k.iconId ? media.get(k.iconId) : undefined })),
      press: press.map((p) => ({ ...p, image: p.imageId ? media.get(p.imageId) : undefined, url: safeUrl(p.url) })),
    };
  });
}

export async function getClients() {
  return cached("clients", ["clients", "media"], async () => {
    const rows = await db
      .select()
      .from(s.clients)
      .where(and(live(s.clients), isNotNull(s.clients.logoId)))
      .orderBy(asc(s.clients.sortOrder));
    const media = await mediaMap(rows.map((r) => r.logoId));
    return rows.map((r) => ({ ...r, logo: media.get(r.logoId!), url: safeUrl(r.url) })).filter((r) => r.logo);
  });
}

export async function getFaqs() {
  return cached("faqs", ["faqs"], () => db.select().from(s.faqs).where(live(s.faqs)).orderBy(asc(s.faqs.sortOrder)));
}

// ── Gallery ───────────────────────────────────────────────────────────────────────────────────────
export async function getAlbums() {
  return cached("albums", ["albums", "media", "categories"], async () => {
    const rows = await db.select().from(s.albums).where(live(s.albums)).orderBy(asc(s.albums.sortOrder), desc(s.albums.date));
    const counts = rows.length
      ? await db
          .select({ albumId: s.media.albumId, n: sql<number>`count(*)` })
          .from(s.media)
          .where(and(inArray(s.media.albumId, rows.map((r) => r.id)), isNull(s.media.deletedAt)))
          .groupBy(s.media.albumId)
      : [];
    const firstImages = rows.length
      ? await db
          .select({ albumId: s.media.albumId, id: sql<number>`min(${s.media.id})` })
          .from(s.media)
          .where(and(inArray(s.media.albumId, rows.map((r) => r.id)), isNull(s.media.deletedAt)))
          .groupBy(s.media.albumId)
      : [];
    const media = await mediaMap([...rows.map((r) => r.coverId), ...firstImages.map((f) => Number(f.id))]);
    const cats = await categoryMap();
    return rows.map((r) => {
      const fallback = firstImages.find((f) => f.albumId === r.id);
      return {
        ...r,
        count: Number(counts.find((c) => c.albumId === r.id)?.n ?? 0),
        cover: (r.coverId ? media.get(r.coverId) : undefined) ?? (fallback ? media.get(Number(fallback.id)) : undefined),
        category: r.categoryId ? cats.get(r.categoryId) : undefined,
      };
    });
  });
}
export async function getAlbum(slug: string) {
  return cached(`album:${slug}`, ["albums", "media"], async () => {
    const album = (await getAlbums()).find((a) => a.slug === slug);
    if (!album) return null;
    const ids = await db
      .select({ id: s.media.id })
      .from(s.media)
      .where(and(eq(s.media.albumId, album.id), isNull(s.media.deletedAt)))
      .orderBy(asc(s.media.albumOrder), asc(s.media.id));
    const media = await mediaMap(ids.map((i) => i.id));
    return { ...album, images: ids.map((i) => media.get(i.id)).filter((m): m is Img => Boolean(m)) };
  });
}

// ── Custom pages ──────────────────────────────────────────────────────────────────────────────────
export async function getPage(slug: string, preview = false) {
  const load = async () => {
    const page = (await db.select().from(s.pages).where(and(eq(s.pages.slug, slug), live(s.pages, preview))))[0];
    if (!page) return null;
    const blocks = await db.select().from(s.pageBlocks).where(eq(s.pageBlocks.pageId, page.id)).orderBy(asc(s.pageBlocks.sortOrder));
    return { ...page, blocks };
  };
  return preview ? load() : cached(`page:${slug}`, ["pages"], load);
}

// ── CV ────────────────────────────────────────────────────────────────────────────────────────────
export async function getPublicCvs() {
  return cached("cvs", ["cv", "media"], async () => {
    const rows = await db
      .select()
      .from(s.cvFiles)
      .where(and(live(s.cvFiles), isNotNull(s.cvFiles.mediaId)))
      .orderBy(desc(s.cvFiles.isPrimary), asc(s.cvFiles.sortOrder));
    return rows;
  });
}
