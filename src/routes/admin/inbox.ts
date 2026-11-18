import { Router, type Response } from "express";
import { and, asc, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as s from "../../db/schema/index.js";
import { adminUrl, appUrl } from "../../config/env.js";
import { driver } from "../../lib/storage/index.js";
import { sendEmail } from "../../lib/jobs.js";
import { T } from "../../lib/mail/templates.js";
import { audit } from "../../lib/audit.js";
import { toCsv } from "../../lib/csv.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { ISSUE_LABEL, STATUS_LABEL } from "../../server/tickets.js";
import { mediaMap } from "../../server/media.js";
import { ah, assertCan, flash } from "./mw.js";

export const inboxRouter = Router();

const csv = (res: Response, name: string, body: string) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${body}`);
};
const like_ = (q: string) => `%${q.replace(/[%_\\]/g, "\\$&").slice(0, 80)}%`;

// ── Private files (message attachments, ticket screenshots) — staff only ──────────────────────────
inboxRouter.get("/files/:id", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const m = (await db.select().from(s.media).where(eq(s.media.id, Number(req.params.id))))[0];
  const obj = m ? await driver(m.driver).get(m.key) : null;
  if (!m || !obj) return res.status(404).send("Not found");
  res.setHeader("Content-Type", m.mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `${m.mime.startsWith("image/") || m.mime === "application/pdf" ? "inline" : "attachment"}; filename="${m.originalName.replace(/[^\w.-]+/g, "_")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  obj.body.pipe(res);
}));

// ── Messages ──────────────────────────────────────────────────────────────────────────────────────
inboxRouter.get("/inbox", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const status = typeof req.query.status === "string" && (s.MESSAGE_STATUS as readonly string[]).includes(req.query.status) ? req.query.status : "";
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const where = and(
    status ? eq(s.messages.status, status as (typeof s.MESSAGE_STATUS)[number]) : sql`${s.messages.status} <> 'spam'`,
    q ? or(like(s.messages.name, like_(q)), like(s.messages.email, like_(q)), like(s.messages.message, like_(q)), like(s.messages.company, like_(q))) : undefined,
  );
  const rows = await db.select().from(s.messages).where(where).orderBy(desc(s.messages.createdAt)).limit(200);
  if (req.query.export === "csv") {
    return csv(res, "messages", toCsv(rows, [["createdAt", "Date"], ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company"], ["inquiryType", "Type"], ["budget", "Budget"], ["timeline", "Timeline"], ["status", "Status"], ["message", "Message"]]));
  }
  const counts = await db.select({ status: s.messages.status, n: sql<number>`count(*)` }).from(s.messages).groupBy(s.messages.status);
  await res.page("admin/inbox/list", { layout: "admin", title: "Messages", rows, status, q, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
}));

inboxRouter.get("/inbox/:id", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const id = Number(req.params.id);
  const m = (await db.select().from(s.messages).where(eq(s.messages.id, id)))[0];
  if (!m) return res.redirect(adminUrl("/inbox"));
  if (m.status === "new") await db.update(s.messages).set({ status: "read" }).where(eq(s.messages.id, id));
  const replies = await db
    .select({ id: s.messageReplies.id, body: s.messageReplies.body, isNote: s.messageReplies.isNote, createdAt: s.messageReplies.createdAt, user: s.users.name })
    .from(s.messageReplies)
    .leftJoin(s.users, eq(s.users.id, s.messageReplies.userId))
    .where(eq(s.messageReplies.messageId, id))
    .orderBy(asc(s.messageReplies.createdAt));
  const attachment = m.attachmentId ? (await mediaMap([m.attachmentId])).get(m.attachmentId) : undefined;
  await res.page("admin/inbox/show", { layout: "admin", title: `Message from ${m.name}`, m: { ...m, status: m.status === "new" ? "read" : m.status }, replies, attachment });
}));

inboxRouter.post("/inbox/:id/reply", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const id = Number(req.params.id);
  const m = (await db.select().from(s.messages).where(eq(s.messages.id, id)))[0];
  const body = sanitizePlain(String(req.body.body ?? "")).slice(0, 10000);
  const isNote = req.body.kind === "note";
  if (!m || !body) {
    flash(res, "error", "Write a reply first.");
    return res.redirect(adminUrl(`/inbox/${id}`));
  }
  await db.insert(s.messageReplies).values({ messageId: id, userId: req.user!.id, body, isNote });
  if (!isNote) {
    const sent = await sendEmail(m.email, { subject: `Re: your ${m.inquiryType.toLowerCase()} enquiry`, heading: `Hello ${m.name.split(" ")[0]},`, paragraphs: body.split(/\n{2,}/), footnote: "You can reply directly to this email." }, req.user!.email);
    await db.update(s.messages).set({ status: "replied" }).where(eq(s.messages.id, id));
    flash(res, sent ? "success" : "info", sent ? "Reply sent." : "Reply saved — email is queued and will be sent when SMTP is available.");
  } else flash(res, "success", "Note added.");
  await audit(req.user, isNote ? "note" : "reply", "messages", id, { ipHash: req.ipHashed });
  res.redirect(adminUrl(`/inbox/${id}`));
}));

inboxRouter.post("/inbox/:id/status", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const st = String(req.body.status);
  if ((s.MESSAGE_STATUS as readonly string[]).includes(st)) {
    await db.update(s.messages).set({ status: st as (typeof s.MESSAGE_STATUS)[number] }).where(eq(s.messages.id, Number(req.params.id)));
    await audit(req.user, "status", "messages", Number(req.params.id), { summary: `Marked as ${st}`, ipHash: req.ipHashed });
  }
  flash(res, "success", `Marked as ${st}.`);
  res.redirect(adminUrl(st === "spam" || st === "archived" ? "/inbox" : `/inbox/${req.params.id}`));
}));

inboxRouter.post("/inbox/bulk", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : [req.body.ids]).map(Number).filter(Boolean);
  const st = String(req.body.action);
  if (ids.length && (s.MESSAGE_STATUS as readonly string[]).includes(st)) await db.update(s.messages).set({ status: st as (typeof s.MESSAGE_STATUS)[number] }).where(inArray(s.messages.id, ids));
  flash(res, "success", `${ids.length} message(s) updated.`);
  res.redirect(adminUrl("/inbox"));
}));

// ── Maintenance tickets ───────────────────────────────────────────────────────────────────────────
inboxRouter.get("/tickets", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const view = req.query.view === "table" ? "table" : "board";
  const f = { priority: String(req.query.priority ?? ""), project: String(req.query.project ?? ""), q: String(req.query.q ?? "") };
  const where = and(
    f.priority && (s.TICKET_PRIORITY as readonly string[]).includes(f.priority) ? eq(s.maintenanceTickets.priority, f.priority as (typeof s.TICKET_PRIORITY)[number]) : undefined,
    /^\d+$/.test(f.project) ? eq(s.maintenanceTickets.projectId, Number(f.project)) : undefined,
    f.q ? or(like(s.maintenanceTickets.ticketNo, like_(f.q)), like(s.maintenanceTickets.clientName, like_(f.q)), like(s.maintenanceTickets.company, like_(f.q)), like(s.maintenanceTickets.email, like_(f.q))) : undefined,
  );
  const rows = await db
    .select({ t: s.maintenanceTickets, project: s.projects.title })
    .from(s.maintenanceTickets)
    .leftJoin(s.projects, eq(s.projects.id, s.maintenanceTickets.projectId))
    .where(where)
    .orderBy(sql`FIELD(${s.maintenanceTickets.priority}, 'critical','high','normal','low')`, desc(s.maintenanceTickets.createdAt))
    .limit(500);
  if (req.query.export === "csv") {
    return csv(res, "tickets", toCsv(rows.map((r) => ({ ...r.t, project: r.project ?? r.t.projectOther })), [["ticketNo", "Ticket"], ["createdAt", "Opened"], ["clientName", "Client"], ["company", "Company"], ["email", "Email"], ["project", "Project"], ["issueType", "Issue"], ["priority", "Priority"], ["status", "Status"], ["dueAt", "Due"], ["description", "Description"]]));
  }
  const projects = await db.select({ id: s.projects.id, title: s.projects.title }).from(s.projects).where(isNull(s.projects.deletedAt)).orderBy(asc(s.projects.title));
  await res.page("admin/tickets/list", { layout: "admin", title: "Maintenance tickets", rows, view, f, projects, statuses: s.TICKET_STATUS, labels: STATUS_LABEL, issues: ISSUE_LABEL });
}));

inboxRouter.get("/tickets/:id", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const id = Number(req.params.id);
  const t = (await db.select().from(s.maintenanceTickets).where(eq(s.maintenanceTickets.id, id)))[0];
  if (!t) return res.redirect(adminUrl("/tickets"));
  const [updates, atts, project] = await Promise.all([
    db
      .select({ u: s.ticketUpdates, user: s.users.name })
      .from(s.ticketUpdates)
      .leftJoin(s.users, eq(s.users.id, s.ticketUpdates.userId))
      .where(eq(s.ticketUpdates.ticketId, id))
      .orderBy(asc(s.ticketUpdates.createdAt)),
    db.select({ id: s.ticketAttachments.mediaId }).from(s.ticketAttachments).where(eq(s.ticketAttachments.ticketId, id)),
    t.projectId ? db.select({ title: s.projects.title }).from(s.projects).where(eq(s.projects.id, t.projectId)) : Promise.resolve([]),
  ]);
  const media = await mediaMap(atts.map((a) => a.id));
  await res.page("admin/tickets/show", { layout: "admin", title: t.ticketNo, t, updates, attachments: [...media.values()], project: project[0]?.title ?? t.projectOther, statuses: s.TICKET_STATUS, priorities: s.TICKET_PRIORITY, labels: STATUS_LABEL, issues: ISSUE_LABEL });
}));

async function changeTicket(ticketId: number, userId: number, patch: { status?: string; priority?: string; dueAt?: Date | null; body?: string; isPublic?: boolean }) {
  const t = (await db.select().from(s.maintenanceTickets).where(eq(s.maintenanceTickets.id, ticketId)))[0];
  if (!t) return null;
  const set: Partial<typeof s.maintenanceTickets.$inferInsert> = {};
  const statusChanged = patch.status && patch.status !== t.status && (s.TICKET_STATUS as readonly string[]).includes(patch.status);
  if (statusChanged) {
    set.status = patch.status as (typeof s.TICKET_STATUS)[number];
    if (["resolved", "closed"].includes(patch.status!)) set.resolvedAt = new Date();
  }
  if (patch.priority && (s.TICKET_PRIORITY as readonly string[]).includes(patch.priority)) set.priority = patch.priority as (typeof s.TICKET_PRIORITY)[number];
  if (patch.dueAt !== undefined) set.dueAt = patch.dueAt;
  if (Object.keys(set).length) await db.update(s.maintenanceTickets).set(set).where(eq(s.maintenanceTickets.id, ticketId));
  if (statusChanged || patch.body) {
    await db.insert(s.ticketUpdates).values({
      ticketId,
      userId,
      body: patch.body || null,
      isPublic: Boolean(patch.isPublic) || (Boolean(statusChanged) && !patch.body),
      statusFrom: statusChanged ? t.status : null,
      statusTo: statusChanged ? patch.status! : null,
    });
  }
  // Client is emailed on public replies and on status changes.
  if ((patch.body && patch.isPublic) || statusChanged) {
    await sendEmail(t.email, T.ticketUpdate({ ticketNo: t.ticketNo, name: t.clientName, status: STATUS_LABEL[(set.status ?? t.status) as string] ?? t.status, body: patch.isPublic ? patch.body : null }));
  }
  return t;
}

inboxRouter.post("/tickets/:id/status", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const t = await changeTicket(Number(req.params.id), req.user!.id, { status: String(req.body.status) });
  await audit(req.user, "status", "tickets", Number(req.params.id), { summary: `Status → ${req.body.status}`, ipHash: req.ipHashed });
  if (req.accepts(["html", "json"]) === "json") return res.json({ ok: Boolean(t) });
  res.redirect(adminUrl(`/tickets/${req.params.id}`));
}));

inboxRouter.post("/tickets/:id/update", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const id = Number(req.params.id);
  const due = String(req.body.dueAt ?? "");
  await changeTicket(id, req.user!.id, {
    status: String(req.body.status ?? ""),
    priority: String(req.body.priority ?? ""),
    dueAt: due ? new Date(`${due}T17:00:00Z`) : null,
    body: sanitizePlain(String(req.body.body ?? "")).slice(0, 10000),
    isPublic: req.body.visibility === "public",
  });
  if (typeof req.body.notes === "string") await db.update(s.maintenanceTickets).set({ notes: sanitizePlain(req.body.notes).slice(0, 10000) || null }).where(eq(s.maintenanceTickets.id, id));
  await audit(req.user, "update", "tickets", id, { summary: "Ticket updated", ipHash: req.ipHashed });
  flash(res, "success", req.body.visibility === "public" && req.body.body ? "Reply posted and emailed to the client." : "Ticket updated.");
  res.redirect(adminUrl(`/tickets/${id}`));
}));

// ── Registrations & training requests ─────────────────────────────────────────────────────────────
inboxRouter.get("/registrations", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const kind = req.query.kind === "training_request" || req.query.kind === "registration" ? req.query.kind : "";
  const rows = await db.select().from(s.courseRegistrations).where(kind ? eq(s.courseRegistrations.kind, kind) : undefined).orderBy(desc(s.courseRegistrations.createdAt)).limit(500);
  if (req.query.export === "csv") return csv(res, "registrations", toCsv(rows, [["createdAt", "Date"], ["kind", "Kind"], ["subject", "Course/training"], ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["company", "Company"], ["seats", "Seats"], ["status", "Status"], ["message", "Message"], ["notes", "Notes"]]));
  await res.page("admin/inbox/registrations", { layout: "admin", title: "Registrations & requests", rows, kind });
}));

inboxRouter.post("/registrations/:id", ah(async (req, res) => {
  assertCan(req, "update", "inbox");
  const st = String(req.body.status);
  await db
    .update(s.courseRegistrations)
    .set({ ...(["new", "contacted", "confirmed", "cancelled"].includes(st) ? { status: st as "new" } : {}), notes: sanitizePlain(String(req.body.notes ?? "")).slice(0, 5000) || null })
    .where(eq(s.courseRegistrations.id, Number(req.params.id)));
  flash(res, "success", "Registration updated.");
  res.redirect(adminUrl("/registrations"));
}));

// ── Subscribers ───────────────────────────────────────────────────────────────────────────────────
inboxRouter.get("/subscribers", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const status = ["pending", "confirmed", "unsubscribed"].includes(String(req.query.status)) ? (String(req.query.status) as "pending") : undefined;
  const rows = await db.select().from(s.subscribers).where(status ? eq(s.subscribers.status, status) : undefined).orderBy(desc(s.subscribers.createdAt)).limit(2000);
  if (req.query.export === "csv") return csv(res, "subscribers", toCsv(rows.filter((r) => r.status === "confirmed" || status), [["email", "Email"], ["status", "Status"], ["confirmedAt", "Confirmed"], ["createdAt", "Signed up"], ["source", "Source"]]));
  await res.page("admin/inbox/subscribers", { layout: "admin", title: "Subscribers", rows, status: status ?? "" });
}));

inboxRouter.post("/subscribers/:id/remove", ah(async (req, res) => {
  assertCan(req, "delete", "inbox");
  await db.update(s.subscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(s.subscribers.id, Number(req.params.id)));
  await audit(req.user, "unsubscribe", "subscribers", Number(req.params.id), { ipHash: req.ipHashed });
  flash(res, "success", "Subscriber unsubscribed.");
  res.redirect(adminUrl("/subscribers"));
}));

// ── Review requests ───────────────────────────────────────────────────────────────────────────────
inboxRouter.get("/review-requests", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const rows = await db
    .select({ r: s.reviewRequests, project: s.projects.title, training: s.trainings.title })
    .from(s.reviewRequests)
    .leftJoin(s.projects, eq(s.projects.id, s.reviewRequests.projectId))
    .leftJoin(s.trainings, eq(s.trainings.id, s.reviewRequests.trainingId))
    .orderBy(desc(s.reviewRequests.createdAt))
    .limit(300);
  const [projects, trainings, types] = await Promise.all([
    db.select({ id: s.projects.id, title: s.projects.title }).from(s.projects).where(isNull(s.projects.deletedAt)).orderBy(asc(s.projects.title)),
    db.select({ id: s.trainings.id, title: s.trainings.title }).from(s.trainings).where(isNull(s.trainings.deletedAt)).orderBy(asc(s.trainings.title)),
    db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).where(and(eq(s.categories.type, "service_type"), isNull(s.categories.deletedAt))),
  ]);
  await res.page("admin/inbox/review-requests", { layout: "admin", title: "Review requests", rows, projects, trainings, types, link: res.locals.flashLink });
}));

inboxRouter.post("/review-requests", ah(async (req, res) => {
  assertCan(req, "create", "inbox");
  const name = sanitizePlain(String(req.body.name ?? "")).slice(0, 191);
  const email = String(req.body.email ?? "").trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    flash(res, "error", "Enter the client's name and a valid email address.");
    return res.redirect(adminUrl("/review-requests"));
  }
  const id = (v: unknown) => (/^\d+$/.test(String(v ?? "")) ? Number(v) : null);
  const days = Math.min(90, Math.max(3, Number(req.body.days) || 30));
  const token = randomToken(24);
  const [r] = await db.insert(s.reviewRequests).values({
    name,
    email,
    projectId: id(req.body.projectId),
    trainingId: id(req.body.trainingId),
    serviceTypeId: id(req.body.serviceTypeId),
    message: sanitizePlain(String(req.body.message ?? "")).slice(0, 2000) || null,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + days * 864e5),
    createdBy: req.user!.id,
  });
  const link = `${appUrl}/review/${token}`;
  const subject = id(req.body.projectId)
    ? (await db.select({ t: s.projects.title }).from(s.projects).where(eq(s.projects.id, id(req.body.projectId)!)))[0]?.t
    : id(req.body.trainingId)
      ? (await db.select({ t: s.trainings.title }).from(s.trainings).where(eq(s.trainings.id, id(req.body.trainingId)!)))[0]?.t
      : null;
  const sent = await sendEmail(email, T.reviewRequest({ name, link, subject, message: sanitizePlain(String(req.body.message ?? "")) || null, days }), req.user!.email);
  await db.update(s.reviewRequests).set({ sentAt: new Date() }).where(eq(s.reviewRequests.id, r.insertId));
  await audit(req.user, "review_request", "review_requests", r.insertId, { summary: `Review link sent to ${email}`, ipHash: req.ipHashed });
  flash(res, "success", sent ? `Review request emailed to ${email}.` : `Review request saved; the email is queued. You can also share this link directly: ${link}`);
  res.redirect(adminUrl("/review-requests"));
}));

inboxRouter.post("/review-requests/:id/revoke", ah(async (req, res) => {
  assertCan(req, "delete", "inbox");
  await db.update(s.reviewRequests).set({ expiresAt: new Date() }).where(eq(s.reviewRequests.id, Number(req.params.id)));
  flash(res, "success", "Link revoked.");
  res.redirect(adminUrl("/review-requests"));
}));

// ── Notifications (bell) ──────────────────────────────────────────────────────────────────────────
inboxRouter.get("/notifications", ah(async (req, res) => {
  assertCan(req, "view", "inbox");
  const [messages, tickets, reviews] = await Promise.all([
    db.select().from(s.messages).where(eq(s.messages.status, "new")).orderBy(desc(s.messages.createdAt)).limit(20),
    db.select().from(s.maintenanceTickets).where(sql`${s.maintenanceTickets.status} IN ('new','acknowledged','in_progress','awaiting_client')`).orderBy(desc(s.maintenanceTickets.createdAt)).limit(20),
    db.select().from(s.testimonials).where(and(eq(s.testimonials.moderation, "pending"), eq(s.testimonials.isSample, false), isNull(s.testimonials.deletedAt))).orderBy(desc(s.testimonials.createdAt)).limit(20),
  ]);
  await res.page("admin/inbox/notifications", { layout: "admin", title: "Notifications", messages, tickets, reviews, labels: STATUS_LABEL });
}));
