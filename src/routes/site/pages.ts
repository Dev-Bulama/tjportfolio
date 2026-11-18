import type { Request, Response } from "express";
import { siteRouter, h } from "./router.js";
import * as Q from "../../server/public.js";
import { abs, breadcrumbLd } from "../../server/seo.js";
import { mediaUrl, type Img } from "../../server/media.js";
import { can } from "../../lib/permissions.js";
import { groupBy, pub, stripHtml, truncate } from "../../lib/util.js";
import type { Settings } from "../../server/settings.js";

type Rm = (m: Record<string, unknown>, img?: Img | null) => unknown;
const meta = (res: Response, m: Record<string, unknown>, img?: Img | null) => (res.locals.resolveMeta as Rm)(m, img);
const preview = (req: Request) => req.query.preview === "1" && can(req.user, "view", "content");
const notFound = () => Object.assign(new Error("Not found"), { status: 404 });

// ── About ─────────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/about", h(async (_req, res) => {
  const s = res.locals.settings as Settings;
  const [about, cvs, clients] = await Promise.all([Q.getAbout(), Q.getPublicCvs(), Q.getClients()]);
  const skillGroups = groupBy(about.skills, (k) => k.category);
  await res.page("site/about", {
    ...about,
    skillGroups,
    leadership: about.experiences.filter((e) => e.isLeadership),
    timeline: about.experiences,
    hasCv: cvs.length > 0,
    clients,
    longBio: s.profile.longBioHtml,
    meta: meta(res, { title: "About", description: truncate(s.profile.shortBio, 160), type: "profile", jsonLd: [breadcrumbLd([["Home", "/"], ["About", "/about"]])] }),
  });
}));

// ── Services ──────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/services", h(async (_req, res) => {
  const [services, faqs] = await Promise.all([Q.getServices(), Q.getFaqs()]);
  await res.page("site/services", { services, faqs, meta: meta(res, { title: "Services", description: "Software engineering, AI agents & automation, corporate technology training, Oracle Database, Lean Six Sigma and courseware development." }) });
}));

siteRouter.get("/services/:slug", h(async (req, res) => {
  const s = await Q.getService(String(req.params.slug), preview(req));
  if (!s) throw notFound();
  await res.page("site/service", {
    s,
    others: (await Q.getServices()).filter((x) => x.id !== s.id),
    meta: meta(
      res,
      {
        title: s.seoTitle || s.title,
        description: s.seoDescription || s.summary,
        noindex: s.status !== "published",
        image: `/og/page.png?title=${encodeURIComponent(s.title)}&kicker=Service`,
        jsonLd: [
          breadcrumbLd([["Home", "/"], ["Services", "/services"], [s.title, `/services/${s.slug}`]]),
          { "@context": "https://schema.org", "@type": "Service", name: s.title, description: s.summary, provider: { "@id": `${res.locals.appUrl}/#person` }, areaServed: "Africa" },
          s.faqs.length ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: s.faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) } : null,
        ].filter(Boolean),
      },
      s.ogImage,
    ),
  });
}));

// ── Work ──────────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/work", h(async (_req, res) => {
  const [projects, categories] = await Promise.all([Q.getProjects(), Q.getCategories("project")]);
  const used = new Set(projects.map((p) => p.category?.slug));
  const tags = [...new Set(projects.flatMap((p) => p.tech))].sort((a, b) => a.localeCompare(b));
  await res.page("site/work", {
    projects,
    categories: categories.filter((c) => used.has(c.slug)),
    tags,
    meta: meta(res, { title: "Work", description: "Selected web apps, mobile apps, websites, AI automation, plugins, Oracle Database and courseware projects by Tijani Bulama." }),
  });
}));

siteRouter.get("/work/:slug", h(async (req, res) => {
  const p = await Q.getProject(String(req.params.slug), preview(req));
  if (!p) throw notFound();
  const video = p.videoUrl ? (await import("../../resources/blocks.js")).embedUrl(/vimeo/.test(p.videoUrl) ? "vimeo" : "youtube", p.videoUrl) : null;
  await res.page("site/project", {
    p,
    video,
    meta: meta(
      res,
      {
        title: p.seoTitle || p.title,
        description: p.seoDescription || p.summary || stripHtml(p.bodyHtml).slice(0, 160),
        noindex: p.status !== "published",
        image: p.cover ? mediaUrl(p.cover, 1280) : `/og/page.png?title=${encodeURIComponent(p.title)}&kicker=${encodeURIComponent(p.category?.name ?? "Case study")}`,
        type: "article",
        jsonLd: [
          breadcrumbLd([["Home", "/"], ["Work", "/work"], [p.title, `/work/${p.slug}`]]),
          {
            "@context": "https://schema.org",
            "@type": ["web-apps", "mobile-apps", "plugins"].includes(p.category?.slug ?? "") ? "SoftwareApplication" : "CreativeWork",
            name: p.title,
            description: p.summary,
            author: { "@id": `${res.locals.appUrl}/#person` },
            ...(p.cover ? { image: abs(mediaUrl(p.cover, 1280)) } : {}),
            ...(p.year ? { dateCreated: String(p.year) } : {}),
            ...(pub(p.liveUrl) ? { url: p.liveUrl } : {}),
            ...(["web-apps", "mobile-apps", "plugins"].includes(p.category?.slug ?? "") ? { applicationCategory: p.category?.name, operatingSystem: p.category?.slug === "mobile-apps" ? "iOS, Android" : "Web" } : {}),
          },
        ],
      },
      p.ogImage,
    ),
  });
}));

// ── Training ──────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/training", h(async (_req, res) => {
  const [trainings, tracks] = await Promise.all([Q.getTrainings(), Q.getCategories("training")]);
  const used = new Set(trainings.map((t) => t.track?.slug));
  await res.page("site/trainings", {
    trainings,
    tracks: tracks.filter((t) => used.has(t.slug)),
    meta: meta(res, { title: "Training", description: "Instructor-led programmes in Oracle Database, AWS, VMware, Lean Six Sigma, software development, AI and cybersecurity, delivered for corporate and public-sector teams." }),
  });
}));

siteRouter.get("/training/:slug", h(async (req, res) => {
  const t = await Q.getTraining(String(req.params.slug), preview(req));
  if (!t) throw notFound();
  await res.page("site/training", {
    t,
    meta: meta(
      res,
      {
        title: t.seoTitle || t.title,
        description: t.seoDescription || t.summary,
        noindex: t.status !== "published",
        image: t.cover ? mediaUrl(t.cover, 1280) : `/og/page.png?title=${encodeURIComponent(t.title)}&kicker=${encodeURIComponent(t.track?.name ?? "Training")}`,
        jsonLd: [
          breadcrumbLd([["Home", "/"], ["Training", "/training"], [t.title, `/training/${t.slug}`]]),
          {
            "@context": "https://schema.org",
            "@type": "Course",
            name: t.title,
            description: t.summary,
            provider: { "@type": "Person", "@id": `${res.locals.appUrl}/#person`, name: (res.locals.settings as Settings).profile.fullName },
            ...(t.modules.length ? { syllabusSections: t.modules.map((m) => ({ "@type": "Syllabus", name: m.title, description: m.description })) } : {}),
            hasCourseInstance: { "@type": "CourseInstance", courseMode: t.format === "virtual" ? "online" : t.format === "hybrid" ? "blended" : "onsite", ...(t.durationLabel ? { courseWorkload: t.durationLabel } : {}) },
          },
        ],
      },
      t.ogImage,
    ),
  });
}));

siteRouter.get("/courses", h(async (_req, res) => {
  const courses = await Q.getCourses();
  await res.page("site/courses", {
    courses,
    meta: meta(res, {
      title: "Courses",
      description: "Upcoming and open courses: dates, fees and registration.",
      jsonLd: courses.map((c) => ({ "@context": "https://schema.org", "@type": "Course", name: c.title, description: c.summary, provider: { "@id": `${res.locals.appUrl}/#person` } })),
    }),
  });
}));

// ── Certifications ────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/certifications", h(async (_req, res) => {
  const [certs, cats] = await Promise.all([Q.getCertifications(), Q.getCategories("certification")]);
  const used = new Set(certs.map((c) => c.category?.slug));
  await res.page("site/certifications", { certs, cats: cats.filter((c) => used.has(c.slug)), meta: meta(res, { title: "Certifications", description: "Professional certifications with issuer verification links." }) });
}));

siteRouter.get("/certifications/:slug", h(async (req, res) => {
  const c = await Q.getCertification(String(req.params.slug));
  if (!c) throw notFound();
  await res.page("site/certification", {
    c,
    meta: meta(res, {
      title: c.seoTitle || `${c.name} — ${c.issuer}`,
      description: c.seoDescription || `${c.name}, issued by ${c.issuer}.`,
      image: c.logo ? mediaUrl(c.logo, 640) : `/og/page.png?title=${encodeURIComponent(c.name)}&kicker=${encodeURIComponent(c.issuer)}`,
      jsonLd: [
        breadcrumbLd([["Home", "/"], ["Certifications", "/certifications"], [c.name, `/certifications/${c.slug}`]]),
        { "@context": "https://schema.org", "@type": "EducationalOccupationalCredential", name: c.name, credentialCategory: "certification", recognizedBy: { "@type": "Organization", name: c.issuer }, ...(c.verifyUrl ? { url: c.verifyUrl } : {}) },
      ],
    }),
  });
}));

// ── Gallery ───────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/gallery", h(async (_req, res) => {
  const albums = await Q.getAlbums();
  await res.page("site/gallery", { albums, meta: meta(res, { title: "Gallery", description: "Photos from training sessions, events, speaking engagements and project launches." }) });
}));

siteRouter.get("/gallery/:slug", h(async (req, res) => {
  const a = await Q.getAlbum(String(req.params.slug));
  if (!a) throw notFound();
  await res.page("site/album", {
    a,
    meta: meta(res, { title: a.seoTitle || a.title, description: a.seoDescription || a.description || `Photos: ${a.title}`, image: a.cover ? mediaUrl(a.cover, 1280) : undefined, jsonLd: [breadcrumbLd([["Home", "/"], ["Gallery", "/gallery"], [a.title, `/gallery/${a.slug}`]])] }),
  });
}));

// ── Testimonials ──────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/testimonials", h(async (_req, res) => {
  const [reviews, types] = await Promise.all([Q.getTestimonials(), Q.getCategories("service_type")]);
  const agg = types
    .map((t) => {
      const rs = reviews.filter((r) => r.serviceTypeId === t.id);
      return { ...t, count: rs.length, avg: rs.length ? rs.reduce((a, r) => a + r.rating, 0) / rs.length : 0 };
    })
    .filter((t) => t.count > 0);
  const overall = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const s = res.locals.settings as Settings;
  await res.page("site/testimonials", {
    reviews,
    agg,
    overall,
    meta: meta(res, {
      title: "Testimonials",
      description: "Reviews from clients and training participants.",
      jsonLd: reviews.length
        ? [
            {
              "@context": "https://schema.org",
              "@type": "ProfessionalService",
              name: s.profile.fullName,
              url: res.locals.appUrl,
              aggregateRating: { "@type": "AggregateRating", ratingValue: overall.toFixed(1), reviewCount: reviews.length, bestRating: 5, worstRating: 1 },
              review: reviews.slice(0, 20).map((r) => ({
                "@type": "Review",
                author: { "@type": "Person", name: r.authorName },
                reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
                reviewBody: r.quote,
                ...(r.date ? { datePublished: r.date } : {}),
              })),
            },
          ]
        : [],
    }),
  });
}));

// ── Insights ──────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/insights", h(async (req, res) => {
  const [posts, cats] = await Promise.all([Q.getPosts(), Q.getCategories("post")]);
  const cat = typeof req.query.category === "string" ? req.query.category : "";
  const tag = typeof req.query.tag === "string" ? req.query.tag : "";
  const filtered = posts.filter((p) => (!cat || p.category?.slug === cat) && (!tag || p.tags.some((t) => t.slug === tag)));
  const used = new Set(posts.map((p) => p.category?.slug));
  await res.page("site/insights", {
    posts: filtered,
    cats: cats.filter((c) => used.has(c.slug)),
    cat,
    tag,
    meta: meta(res, { title: "Insights", description: "Writing on AI agents and automation, Oracle and databases, engineering practice and building training that works." }),
  });
}));

siteRouter.get("/insights/:slug", h(async (req, res) => {
  const p = await Q.getPost(String(req.params.slug), preview(req));
  if (!p) throw notFound();
  const s = res.locals.settings as Settings;
  await res.page("site/post", {
    p,
    meta: meta(
      res,
      {
        title: p.seoTitle || p.title,
        description: p.seoDescription || p.excerpt,
        type: "article",
        noindex: p.status === "draft",
        publishedTime: p.publishedAt?.toISOString(),
        image: p.cover ? mediaUrl(p.cover, 1280) : `/og/page.png?title=${encodeURIComponent(p.title)}&kicker=${encodeURIComponent(p.category?.name ?? "Insights")}`,
        jsonLd: [
          breadcrumbLd([["Home", "/"], ["Insights", "/insights"], [p.title, `/insights/${p.slug}`]]),
          {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: p.title,
            description: p.excerpt,
            author: { "@type": "Person", "@id": `${res.locals.appUrl}/#person`, name: p.authorName ?? s.profile.fullName },
            ...(p.publishedAt ? { datePublished: p.publishedAt.toISOString() } : {}),
            dateModified: p.updatedAt.toISOString(),
            ...(p.cover ? { image: abs(mediaUrl(p.cover, 1280)) } : {}),
            mainEntityOfPage: abs(`/insights/${p.slug}`),
          },
        ],
      },
      p.ogImage,
    ),
  });
}));

// ── Resume ────────────────────────────────────────────────────────────────────────────────────────
siteRouter.get("/resume", h(async (_req, res) => {
  const [about, cvs, certs, trainings] = await Promise.all([Q.getAbout(), Q.getPublicCvs(), Q.getCertifications(), Q.getTrainings()]);
  await res.page("site/resume", {
    ...about,
    skillGroups: groupBy(about.skills, (k) => k.category),
    cvs,
    certs,
    trainings,
    meta: meta(res, { title: "Resume", description: "Experience, skills, certifications and trainings delivered. Download the CV as PDF." }),
  });
}));

