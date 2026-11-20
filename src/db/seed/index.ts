import path from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "../index.js";
import * as s from "../schema/index.js";
import { readingMinutes, slugify } from "../../lib/util.js";
import * as P from "./data-profile.js";
import { services } from "./data-services.js";
import { projects, trainings } from "./data-work.js";
import { posts, privacyHtml, termsHtml } from "./data-posts.js";

type Log = (msg: string) => void;

async function setting(key: string, value: unknown): Promise<void> {
  // Never overwrite values the owner has edited: insert only when missing.
  await db.insert(s.settings).values({ key, value }).onDuplicateKeyUpdate({ set: { key: sql`\`key\`` } });
}

async function categoryIds(): Promise<Map<string, number>> {
  const rows = await db.select({ id: s.categories.id, type: s.categories.type, slug: s.categories.slug }).from(s.categories);
  return new Map(rows.map((r) => [`${r.type}:${r.slug}`, r.id]));
}

/**
 * Idempotent seed (brief §11). Safe to run repeatedly: every insert is guarded by a natural key,
 * and nothing the owner has already edited is overwritten.
 */
export async function runSeed(log: Log = () => {}): Promise<{ created: number }> {
  let created = 0;
  const now = new Date();

  // ── Settings ──────────────────────────────────────────────────────────────────────────────────
  await setting("profile", P.profile);
  await setting("branding", P.branding);
  await setting("seo", P.seoDefaults);
  await setting("integrations", P.integrations);
  await setting("site", P.siteSettings);
  log("settings");

  // ── Categories ────────────────────────────────────────────────────────────────────────────────
  for (const [type, list] of Object.entries(P.categories)) {
    let i = 0;
    for (const [name, slug] of list) {
      const res = await db
        .insert(s.categories)
        .ignore()
        .values({ type: type as (typeof s.CATEGORY_TYPES)[number], name, slug, status: "published", sortOrder: i++ });
      created += res[0].affectedRows;
    }
  }
  const cats = await categoryIds();
  const cat = (type: string, slug: string) => cats.get(`${type}:${slug}`) ?? null;
  log("categories");

  // ── Small ordered lists: only seeded when the table is empty ──────────────────────────────────
  const empty = async (table: typeof s.socialLinks | typeof s.stats | typeof s.experiences | typeof s.skills | typeof s.clients | typeof s.faqs | typeof s.education) =>
    ((await db.select({ n: sql<number>`count(*)` }).from(table))[0]?.n ?? 0) === 0;

  if (await empty(s.socialLinks)) {
    await db.insert(s.socialLinks).values(P.socials.map((x, i) => ({ ...x, status: "published" as const, sortOrder: i })));
    created += P.socials.length;
  }
  if (await empty(s.stats)) {
    await db.insert(s.stats).values(P.stats.map((x, i) => ({ ...x, status: "published" as const, sortOrder: i })));
    created += P.stats.length;
  }
  for (const [i, h] of P.homepageSections.entries()) {
    const r = await db.insert(s.homepageSections).ignore().values({ ...h, status: "published", sortOrder: i });
    created += r[0].affectedRows;
  }
  if (await empty(s.experiences)) {
    await db.insert(s.experiences).values(P.experiences.map((x, i) => ({ ...x, periodLabel: "[[add dates]]", status: "published" as const, publishedAt: now, sortOrder: i })));
    created += P.experiences.length;
  }
  if (await empty(s.education)) {
    await db.insert(s.education).values({
      institution: "[[add institution]]",
      qualification: "[[add qualification]]",
      field: "[[add field of study]]",
      notes: "Completed National Youth Service (NYSC) at the Katsina State Directorate of ICT (KATDICT).",
      status: "draft",
      sortOrder: 0,
    });
    created += 1;
  }
  if (await empty(s.skills)) {
    await db.insert(s.skills).values(
      P.skills.map(([name, category, proficiency], i) => ({
        name,
        category: category as (typeof s.SKILL_CATEGORIES)[number],
        proficiency,
        showOnHome: proficiency >= 5,
        status: "published" as const,
        publishedAt: now,
        sortOrder: i,
      })),
    );
    created += P.skills.length;
  }
  if (await empty(s.clients)) {
    await db.insert(s.clients).values(
      P.clients.map((name, i) => ({ name, note: name.includes("LSETF") ? "Proposal" : null, status: "published" as const, sortOrder: i })),
    );
    created += P.clients.length;
  }
  if (await empty(s.faqs)) {
    await db.insert(s.faqs).values(P.faqs.map((f, i) => ({ question: f.q, answer: f.a, categoryId: cat("faq", f.cat), status: "published" as const, sortOrder: i })));
    created += P.faqs.length;
  }
  log("lists");

  // ── Skills lookup for project tech stacks ─────────────────────────────────────────────────────
  const skillRows = await db.select({ id: s.skills.id, name: s.skills.name }).from(s.skills);
  const skillId = new Map(skillRows.map((r) => [r.name, r.id]));

  // ── Services (published) ──────────────────────────────────────────────────────────────────────
  for (const [i, sv] of services.entries()) {
    const exists = await db.select({ id: s.services.id }).from(s.services).where(eq(s.services.slug, sv.slug));
    if (exists.length) continue;
    const [res] = await db.insert(s.services).values({
      title: sv.title,
      slug: sv.slug,
      icon: sv.icon,
      summary: sv.summary,
      bodyHtml: sv.body,
      deliverables: sv.deliverables,
      process: sv.process,
      ctaText: sv.cta,
      serviceTypeId: cat("service_type", sv.serviceType),
      projectCategoryIds: sv.projectCategories.map((c) => cat("project", c)).filter((x): x is number => x !== null),
      status: "published",
      publishedAt: now,
      featured: true,
      sortOrder: i,
    });
    await db.insert(s.serviceFaqs).values(sv.faqs.map(([question, answer], j) => ({ serviceId: res.insertId, question, answer, sortOrder: j })));
    created++;
  }
  log("services");

  // ── Trainings (published) ─────────────────────────────────────────────────────────────────────
  for (const [i, t] of trainings.entries()) {
    const slug = slugify(t.title.replace(/—.*$/, "").replace(/\(.*?\)/g, ""));
    const exists = await db.select({ id: s.trainings.id }).from(s.trainings).where(eq(s.trainings.slug, slug));
    if (exists.length) continue;
    const bodyHtml = `<p>${t.summary}</p><p>Every session is hands-on: participants work through guided labs, apply each module to realistic scenarios and leave with materials they can reuse at work.</p>`;
    const [res] = await db.insert(s.trainings).values({
      title: t.title,
      slug,
      trackId: cat("training", t.track),
      clientName: t.client ?? null,
      showClient: Boolean(t.client),
      format: t.format,
      durationLabel: t.duration ?? "[[add duration]]",
      location: t.format === "virtual" ? "Virtual" : "[[add location]]",
      participants: null,
      summary: t.summary,
      bodyHtml,
      outcomes: t.outcomes,
      status: "published",
      publishedAt: now,
      featured: i < 6,
      sortOrder: i,
    });
    await db.insert(s.trainingModules).values(t.modules.map(([title, description], j) => ({ trainingId: res.insertId, title, description, sortOrder: j })));
    created++;
  }
  log("trainings");

  // ── Projects (drafts — TJ confirms details before publishing) ─────────────────────────────────
  for (const [i, p] of projects.entries()) {
    const slug = slugify(p.title.replace(/\(.*?\)/g, ""));
    const exists = await db.select({ id: s.projects.id }).from(s.projects).where(eq(s.projects.slug, slug));
    if (exists.length) continue;
    const [res] = await db.insert(s.projects).values({
      title: p.title,
      slug,
      categoryId: cat("project", p.category),
      clientName: p.client ?? null,
      showClient: Boolean(p.client),
      role: p.role ?? null,
      year: null,
      projectStatus: p.status ?? "completed",
      summary: p.summary,
      bodyHtml: `<h2>The problem</h2><p>[[Describe the client's problem and context.]]</p><h2>Approach</h2><p>[[How you approached it.]]</p><h2>Solution</h2><p>${p.summary}</p><h2>Results</h2><p>[[Measurable outcomes.]]</p>`,
      status: "draft",
      featured: i < 6,
      sortOrder: i,
    });
    const ids = (p.skills ?? []).map((n) => skillId.get(n)).filter((x): x is number => typeof x === "number");
    if (ids.length) await db.insert(s.projectSkills).values(ids.map((skill, j) => ({ projectId: res.insertId, skillId: skill, sortOrder: j })));
    created++;
  }
  log("projects");

  // ── Certifications: one sample per track, never public until edited ───────────────────────────
  for (const [i, [name, slug]] of P.categories.certification.entries()) {
    const certSlug = `sample-${slug}`;
    const r = await db.insert(s.certifications).ignore().values({
      name: "[[Certification name]]",
      slug: certSlug,
      issuer: "[[Issuer]]",
      categoryId: cat("certification", slug),
      credentialId: "[[ID]]",
      verifyUrl: "[[URL]]",
      description: `Placeholder for a ${name} certification. Replace every field, upload the certificate, then publish.`,
      status: "draft",
      isSample: true,
      sortOrder: i,
    });
    created += r[0].affectedRows;
  }
  log("certifications");

  // ── Testimonials: 3 sample drafts per service type, pending, never published automatically ────
  const sampleCount = (await db.select({ n: sql<number>`count(*)` }).from(s.testimonials).where(eq(s.testimonials.isSample, true)))[0]?.n ?? 0;
  if (sampleCount === 0) {
    const rows = P.categories.service_type.flatMap(([name, slug]) =>
      [1, 2, 3].map((n) => ({
        authorName: "Sample Reviewer",
        authorRole: "[[Role]]",
        company: "[[Company]]",
        rating: 5,
        serviceTypeId: cat("service_type", slug),
        quote: `Sample ${name} review #${n}. This placeholder only previews the layout — send a review request to a real client and replace or delete this entry.`,
        source: "direct" as const,
        consent: false,
        moderation: "pending" as const,
        status: "draft" as const,
        isSample: true,
        sortOrder: n,
      })),
    );
    await db.insert(s.testimonials).values(rows);
    created += rows.length;
  }
  log("testimonials");

  // ── Posts (drafts) ────────────────────────────────────────────────────────────────────────────
  const owner = (await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.role, "owner")).limit(1))[0];
  for (const p of posts) {
    const r = await db.insert(s.posts).ignore().values({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      bodyHtml: p.body,
      categoryId: cat("post", p.category),
      authorId: owner?.id ?? null,
      readingMinutes: readingMinutes(p.body),
      status: "draft",
    });
    created += r[0].affectedRows;
  }
  log("posts");

  // ── Gallery albums (empty) ────────────────────────────────────────────────────────────────────
  for (const [i, [title, catSlug, description]] of P.albums.entries()) {
    const r = await db.insert(s.albums).ignore().values({
      title,
      slug: slugify(title),
      description,
      categoryId: cat("album", catSlug),
      status: "published",
      publishedAt: now,
      sortOrder: i,
    });
    created += r[0].affectedRows;
  }
  log("albums");

  // ── Legal pages (custom pages with one rich-text block) ───────────────────────────────────────
  for (const [title, slug, html] of [
    ["Privacy notice", "privacy", privacyHtml],
    ["Terms of use", "terms", termsHtml],
  ] as const) {
    const exists = await db.select({ id: s.pages.id }).from(s.pages).where(eq(s.pages.slug, slug));
    if (exists.length) continue;
    const [res] = await db.insert(s.pages).values({ title, slug, status: "published", publishedAt: now });
    await db.insert(s.pageBlocks).values([
      { pageId: res.insertId, type: "hero", data: { kicker: "Legal", title, subtitle: `Last updated ${now.toISOString().slice(0, 10)}`, align: "left" }, sortOrder: 0 },
      { pageId: res.insertId, type: "richtext", data: { html }, sortOrder: 1 },
    ]);
    created++;
  }
  log("pages");

  // ── Menus ─────────────────────────────────────────────────────────────────────────────────────
  for (const [key, items] of Object.entries(P.menus)) {
    await db.insert(s.menus).ignore().values({ key, name: key[0]!.toUpperCase() + key.slice(1) });
    const menu = (await db.select().from(s.menus).where(eq(s.menus.key, key)))[0]!;
    const has = await db.select({ id: s.menuItems.id }).from(s.menuItems).where(and(eq(s.menuItems.menuId, menu.id)));
    if (has.length) continue;
    await db.insert(s.menuItems).values(items.map(([label, href], i) => ({ menuId: menu.id, label, href, sortOrder: i })));
    created += items.length;
  }
  log("menus");

  // ── CV placeholder entry (file uploaded later by the owner) ───────────────────────────────────
  const cvCount = (await db.select({ n: sql<number>`count(*)` }).from(s.cvFiles))[0]?.n ?? 0;
  if (cvCount === 0) {
    await db.insert(s.cvFiles).values({ title: "Software Engineering & Training CV", isPrimary: true, status: "draft" });
    created++;
  }

  return { created };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSeed((m) => console.log(`  ✓ ${m}`))
    .then(async (r) => {
      console.log(`Seed complete (${r.created} rows created).`);
      await pool.end();
    })
    .catch(async (e) => {
      console.error(e);
      await pool.end();
      process.exit(1);
    });
}
