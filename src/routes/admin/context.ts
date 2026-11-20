import type { NextFunction, Request, Response } from "express";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as s from "../../db/schema/index.js";
import { adminBase, adminUrl, smtpConfigured } from "../../config/env.js";
import { can } from "../../lib/permissions.js";
import { storageHealth } from "../../lib/storage/index.js";
import { escapeHtml } from "../../lib/util.js";
import { NAV } from "./nav.js";
import { RESOURCES } from "../../resources/registry.js";

async function count(q: Promise<Array<{ n: number }>>): Promise<number> {
  return Number((await q)[0]?.n ?? 0);
}

/** Shared admin layout data: permitted nav, badge counts, warnings banners, palette entries. */
export async function adminContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    res.locals.adminPath = req.path.replace(/\/$/, "") || "/";
    res.locals.nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(user, i.perm[0], i.perm[1])) })).filter((g) => g.items.length);
    const n = sql<number>`count(*)`;
    const [messages, tickets, reviews, samples] = await Promise.all([
      count(db.select({ n }).from(s.messages).where(eq(s.messages.status, "new"))),
      count(db.select({ n }).from(s.maintenanceTickets).where(sql`${s.maintenanceTickets.status} NOT IN ('resolved','closed')`)),
      count(db.select({ n }).from(s.testimonials).where(and(eq(s.testimonials.moderation, "pending"), eq(s.testimonials.isSample, false), isNull(s.testimonials.deletedAt)))),
      count(
        db
          .select({ n: sql<number>`(select count(*) from testimonials where is_sample = 1 and deleted_at is null) + (select count(*) from certifications where is_sample = 1 and deleted_at is null)` })
          .from(sql`dual`),
      ),
    ]);
    res.locals.badges = { "/inbox": messages, "/tickets": tickets, "/content/testimonials": reviews, total: messages + tickets + reviews };
    const banners: Array<{ type: "info" | "danger"; html: string }> = [];
    if (samples > 0 && can(user, "update", "content")) {
      banners.push({
        type: "info",
        html: `<strong>${samples} sample items</strong> (testimonials and certifications) are placeholders and are never shown publicly. <a class="underline" href="${adminUrl("/content/testimonials?sample=1")}">Replace them</a> with real, verified content.`,
      });
    }
    const st = storageHealth();
    if (st && !st.ok) banners.push({ type: "danger", html: `<strong>Storage problem:</strong> ${escapeHtml(st.detail)}` });
    if (!smtpConfigured && can(user, "view", "settings")) banners.push({ type: "danger", html: "<strong>Email is not configured.</strong> Messages are stored and will be sent once SMTP settings are added (SMTP_USER / SMTP_PASSWORD)." });
    res.locals.banners = banners;
    res.locals.paletteItems = [
      ...NAV.flatMap((g) => g.items.filter((i) => !i.perm || can(user, i.perm[0], i.perm[1])).map((i) => ({ label: i.label, group: g.label || "Go to", href: adminUrl(i.href) }))),
      ...(can(user, "create", "content")
        ? Object.values(RESOURCES)
            .filter((r) => r.canCreate !== false)
            .map((r) => ({ label: `New ${r.singular.toLowerCase()}`, group: "Create", href: adminUrl(`/content/${r.key}/new`) }))
        : []),
      { label: "Account & security", group: "Go to", href: adminUrl("/account") },
      { label: "View public site", group: "Go to", href: "/" },
    ];
    res.locals.searchUrl = adminUrl("/search");
    res.locals.adminBase = adminBase;
    next();
  } catch (e) {
    next(e);
  }
}
