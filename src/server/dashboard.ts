import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import * as s from "../db/schema/index.js";

const n = sql<number>`count(*)`;
const one = async (q: Promise<Array<{ n: number }>>) => Number((await q)[0]?.n ?? 0);

export async function dashboardData() {
  const now = Date.now();
  const day = new Date(now - 24 * 3600e3);
  const week = new Date(now - 7 * 24 * 3600e3);
  const month = new Date(now - 30 * 24 * 3600e3);
  const uniq = sql<number>`count(distinct ${s.analyticsHits.visitorHash})`;
  const [today, d7, d30, views30, cvDownloads, newMessages, openTickets, pendingReviews, sampleReviews, sampleCerts, publishedProjects, draftProjects, realReviews, cvReady, portraitSet] = await Promise.all([
    one(db.select({ n: uniq }).from(s.analyticsHits).where(gte(s.analyticsHits.ts, day))),
    one(db.select({ n: uniq }).from(s.analyticsHits).where(gte(s.analyticsHits.ts, week))),
    one(db.select({ n: uniq }).from(s.analyticsHits).where(gte(s.analyticsHits.ts, month))),
    one(db.select({ n }).from(s.analyticsHits).where(gte(s.analyticsHits.ts, month))),
    one(db.select({ n: sql<number>`coalesce(sum(${s.cvFiles.downloads}),0)` }).from(s.cvFiles)),
    one(db.select({ n }).from(s.messages).where(eq(s.messages.status, "new"))),
    one(db.select({ n }).from(s.maintenanceTickets).where(sql`${s.maintenanceTickets.status} NOT IN ('resolved','closed')`)),
    one(db.select({ n }).from(s.testimonials).where(and(eq(s.testimonials.moderation, "pending"), eq(s.testimonials.isSample, false), isNull(s.testimonials.deletedAt)))),
    one(db.select({ n }).from(s.testimonials).where(and(eq(s.testimonials.isSample, true), isNull(s.testimonials.deletedAt)))),
    one(db.select({ n }).from(s.certifications).where(and(eq(s.certifications.isSample, true), isNull(s.certifications.deletedAt)))),
    one(db.select({ n }).from(s.projects).where(and(eq(s.projects.status, "published"), isNull(s.projects.deletedAt)))),
    one(db.select({ n }).from(s.projects).where(and(eq(s.projects.status, "draft"), isNull(s.projects.deletedAt)))),
    one(db.select({ n }).from(s.testimonials).where(and(eq(s.testimonials.isSample, false), eq(s.testimonials.moderation, "approved"), isNull(s.testimonials.deletedAt)))),
    one(db.select({ n }).from(s.cvFiles).where(and(eq(s.cvFiles.status, "published"), sql`${s.cvFiles.mediaId} is not null`, isNull(s.cvFiles.deletedAt)))),
    one(db.select({ n: sql<number>`count(*)` }).from(s.settings).where(sql`${s.settings.key} = 'profile' AND JSON_EXTRACT(${s.settings.value}, '$.portraitId') IS NOT NULL AND JSON_TYPE(JSON_EXTRACT(${s.settings.value}, '$.portraitId')) <> 'NULL'`)),
  ]);
  const series = await db
    .select({ day: sql<string>`DATE(${s.analyticsHits.ts})`, views: n, visitors: uniq })
    .from(s.analyticsHits)
    .where(gte(s.analyticsHits.ts, new Date(now - 14 * 24 * 3600e3)))
    .groupBy(sql`DATE(${s.analyticsHits.ts})`)
    .orderBy(sql`DATE(${s.analyticsHits.ts})`);
  const topPages = await db
    .select({ path: s.analyticsHits.path, views: n })
    .from(s.analyticsHits)
    .where(gte(s.analyticsHits.ts, month))
    .groupBy(s.analyticsHits.path)
    .orderBy(desc(n))
    .limit(6);
  const topRefs = await db
    .select({ ref: s.analyticsHits.referrer, views: n })
    .from(s.analyticsHits)
    .where(and(gte(s.analyticsHits.ts, month), sql`${s.analyticsHits.referrer} is not null`))
    .groupBy(s.analyticsHits.referrer)
    .orderBy(desc(n))
    .limit(6);
  const activity = await db.select().from(s.auditLogs).orderBy(desc(s.auditLogs.createdAt)).limit(10);
  const checklist = [
    { done: realReviews > 0 && sampleReviews === 0, label: "Send review requests to real clients", href: "/review-requests", detail: sampleReviews ? `${sampleReviews} sample reviews still to replace` : "" },
    { done: sampleCerts === 0, label: "Replace sample certifications with your real credentials", href: "/content/certifications?sample=1", detail: sampleCerts ? `${sampleCerts} samples left` : "" },
    { done: portraitSet > 0, label: "Upload your portrait", href: "/settings#profile", detail: "" },
    { done: publishedProjects > 0, label: "Review and publish your projects", href: "/content/projects", detail: draftProjects ? `${draftProjects} drafts waiting` : "" },
    { done: cvReady > 0, label: "Upload and publish your CV (PDF)", href: "/content/cvs", detail: "" },
    { done: false, label: "Fill in contact details and social links", href: "/content/socials", detail: "Values in [[brackets]] stay hidden until replaced", key: "contact" },
  ];
  return { kpi: { today, d7, d30, views30, cvDownloads, newMessages, openTickets, pendingReviews }, series, topPages, topRefs, activity, checklist };
}
