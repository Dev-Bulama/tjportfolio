import crypto from "node:crypto";
import type { Request } from "express";
import { and, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { analyticsDaily, analyticsEvents, analyticsHits } from "../db/schema/index.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link|whatsapp|telegrambot|discordbot|preview|lighthouse|headless|phantom|curl|wget|python-requests|httpclient|axios|node-fetch|go-http|java\/|monitor|uptime|pingdom|semrush|ahrefs|mj12/i;

export function isBot(ua: string | undefined): boolean {
  return !ua || ua.length < 10 || BOT.test(ua);
}

/** Tiny UA parser — device / browser / OS families only. */
export function parseUA(ua = ""): { device: string; browser: string; os: string } {
  const device = /ipad|tablet|kindle|silk|playbook/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua)) ? "tablet" : /mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua) ? "mobile" : "desktop";
  const browser = /edg\//i.test(ua)
    ? "Edge"
    : /opr\/|opera/i.test(ua)
      ? "Opera"
      : /samsungbrowser/i.test(ua)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(ua)
          ? "Firefox"
          : /chrome|crios/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
              ? "Safari"
              : "Other";
  const os = /windows/i.test(ua) ? "Windows" : /android/i.test(ua) ? "Android" : /iphone|ipad|ipod|ios/i.test(ua) ? "iOS" : /mac os x|macintosh/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "Other";
  return { device, browser, os };
}

/**
 * Anonymous visitor id: HMAC of IP + user agent with a salt that rotates daily.
 * No cookies, no raw IP stored; the same person can't be linked across days (brief §4.10).
 */
export function visitorHash(ip: string | undefined, ua: string | undefined, day = new Date().toISOString().slice(0, 10)): string {
  return crypto.createHmac("sha256", `${env.ANALYTICS_SALT}:${day}`).update(`${ip ?? ""}|${ua ?? ""}`).digest("hex").slice(0, 32);
}

export function referrerDomain(ref: string | undefined, selfHost: string): string | null {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h && h !== selfHost.replace(/^www\./, "") ? h.slice(0, 191) : null;
  } catch {
    return null;
  }
}

function country(req: Request): string | null {
  const c = req.get("cf-ipcountry") ?? req.get("x-vercel-ip-country") ?? req.get("x-country-code") ?? req.get("x-geo-country");
  return c && /^[A-Z]{2}$/i.test(c) && c.toUpperCase() !== "XX" ? c.toUpperCase() : null;
}

/** Should this request be counted? Excludes signed-in staff, bots and Do-Not-Track. */
export function trackable(req: Request): boolean {
  return !req.user && !isBot(req.get("user-agent")) && req.get("dnt") !== "1" && req.get("sec-gpc") !== "1";
}

export async function recordHit(req: Request, input: { path: string; ref?: string; q?: string }): Promise<void> {
  if (!trackable(req)) return;
  const path = input.path.split("?")[0]!.slice(0, 255);
  if (!path.startsWith("/") || path.startsWith(`/${env.ADMIN_PATH}`) || path.startsWith("/api/")) return;
  const ua = req.get("user-agent");
  const utm = new URLSearchParams(input.q ?? "");
  const { device, browser, os } = parseUA(ua);
  await db.insert(analyticsHits).values({
    path,
    referrer: referrerDomain(input.ref, req.hostname),
    utmSource: utm.get("utm_source")?.slice(0, 100) || null,
    utmMedium: utm.get("utm_medium")?.slice(0, 100) || null,
    utmCampaign: utm.get("utm_campaign")?.slice(0, 100) || null,
    device,
    browser,
    os,
    country: country(req),
    visitorHash: visitorHash(req.ip, ua),
  });
}

export const EVENT_NAMES = [
  "cv_download",
  "certificate_view",
  "verify_click",
  "contact_submit",
  "maintenance_submit",
  "project_view",
  "social_click",
  "whatsapp_click",
  "course_registration",
  "form_submit",
] as const;

export async function trackEvent(req: Request, name: string, label?: string | null, path?: string): Promise<void> {
  if (!trackable(req)) return;
  try {
    await db.insert(analyticsEvents).values({
      name: name.slice(0, 60),
      label: label?.slice(0, 255) ?? null,
      path: (path ?? req.get("referer")?.replace(/^https?:\/\/[^/]+/, "") ?? req.path).slice(0, 255),
      visitorHash: visitorHash(req.ip, req.get("user-agent")),
    });
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "event not recorded");
  }
}

/** Nightly roll-up: aggregates raw hits/events for each day into analytics_daily (idempotent). */
export async function rollup(days = 3): Promise<number> {
  let rows = 0;
  for (let i = days; i >= 0; i--) {
    const day = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const start = new Date(`${day}T00:00:00Z`);
    const end = new Date(start.getTime() + 864e5);
    const inDay = and(gte(analyticsHits.ts, start), lt(analyticsHits.ts, end));
    const n = sql<number>`count(*)`;
    const groups: Array<[string, Array<{ key: string | null; value: number }>]> = [
      ["pageviews", await db.select({ key: sql<string>`''`, value: n }).from(analyticsHits).where(inDay)],
      ["visitors", await db.select({ key: sql<string>`''`, value: sql<number>`count(distinct ${analyticsHits.visitorHash})` }).from(analyticsHits).where(inDay)],
      ["path", await db.select({ key: analyticsHits.path, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.path)],
      ["referrer", await db.select({ key: analyticsHits.referrer, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.referrer)],
      ["country", await db.select({ key: analyticsHits.country, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.country)],
      ["device", await db.select({ key: analyticsHits.device, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.device)],
      ["browser", await db.select({ key: analyticsHits.browser, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.browser)],
      ["os", await db.select({ key: analyticsHits.os, value: n }).from(analyticsHits).where(inDay).groupBy(analyticsHits.os)],
      ["utm", await db.select({ key: sql<string>`concat_ws(' / ', ${analyticsHits.utmSource}, ${analyticsHits.utmMedium}, ${analyticsHits.utmCampaign})`, value: n }).from(analyticsHits).where(and(inDay, sql`${analyticsHits.utmSource} is not null`)).groupBy(analyticsHits.utmSource, analyticsHits.utmMedium, analyticsHits.utmCampaign)],
      ["event", await db.select({ key: analyticsEvents.name, value: n }).from(analyticsEvents).where(and(gte(analyticsEvents.ts, start), lt(analyticsEvents.ts, end))).groupBy(analyticsEvents.name)],
    ];
    for (const [kind, list] of groups) {
      for (const r of list) {
        if (r.key === null && kind !== "pageviews" && kind !== "visitors") continue;
        await db
          .insert(analyticsDaily)
          .values({ day, kind, key: (r.key ?? "").slice(0, 191), value: Number(r.value) })
          .onDuplicateKeyUpdate({ set: { value: Number(r.value) } });
        rows++;
      }
    }
  }
  return rows;
}

export async function pruneAnalytics(retentionDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 864e5);
  // Only prune days that are already rolled up (everything older than 3 days is).
  await db.delete(analyticsHits).where(lt(analyticsHits.ts, cutoff));
  await db.delete(analyticsEvents).where(lt(analyticsEvents.ts, cutoff));
}
