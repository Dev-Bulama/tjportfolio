import type { Request, Response } from "express";
import multer from "multer";
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import { siteRouter, h } from "./router.js";
import { db } from "../../db/index.js";
import * as s from "../../db/schema/index.js";
import { adminUrl, appUrl, turnstileConfigured } from "../../config/env.js";
import { checkCsrf } from "../../middleware/context.js";
import { rateLimit } from "../../lib/rate-limit.js";
import { verifyTurnstile } from "../../lib/turnstile.js";
import { notifyAdmin, sendEmail } from "../../lib/jobs.js";
import { T } from "../../lib/mail/templates.js";
import { randomToken, sha256 } from "../../lib/crypto.js";
import { bust } from "../../lib/cache.js";
import { escapeHtml } from "../../lib/util.js";
import { checkbox, email, optStr, parse, str, z, type FieldErrors } from "../../lib/validation.js";
import { storeUpload, UploadError } from "../../server/upload.js";
import { createTicket, findTicket, ISSUE_LABEL, STATUS_LABEL } from "../../server/tickets.js";
import { trackEvent } from "../../server/analytics.js";
import * as Q from "../../server/public.js";
import type { Settings } from "../../server/settings.js";

export const INQUIRY_TYPES = ["Software project", "AI & automation", "Corporate training", "Oracle Database", "Lean Six Sigma", "Courseware", "Speaking", "Other"];
export const BUDGETS = ["Not sure yet", "Under ₦1m / $1k", "₦1m–₦5m / $1k–$5k", "₦5m–₦15m / $5k–$15k", "₦15m+ / $15k+"];
export const TIMELINES = ["As soon as possible", "Within a month", "1–3 months", "3+ months", "Just exploring"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 5, fields: 40 } });
type Rm = (m: Record<string, unknown>) => unknown;
const meta = (res: Response, m: Record<string, unknown>) => (res.locals.resolveMeta as Rm)(m);
const wantsJson = (req: Request) => req.accepts(["html", "json"]) === "json";

/** Shared anti-spam gate (brief §7): CSRF, honeypot, Turnstile, 5 submissions / 10 min / IP hash. */
async function gate(req: Request, bucket: string): Promise<{ ok: true } | { ok: false; status: number; error: string; silent?: boolean }> {
  if (!checkCsrf(req)) return { ok: false, status: 403, error: "Your session expired. Reload the page and try again." };
  if (typeof req.body.website === "string" && req.body.website.trim() !== "") return { ok: false, status: 200, error: "", silent: true };
  if (!(await verifyTurnstile(req.body["cf-turnstile-response"], req.ip))) return { ok: false, status: 400, error: "Please complete the anti-spam check and try again." };
  const lim = await rateLimit(`form:${bucket}`, req.ipHashed, 5, 600);
  if (!lim.ok) return { ok: false, status: 429, error: "You've sent several messages in a short time. Please wait a few minutes and try again." };
  return { ok: true };
}

function respond(req: Request, res: Response, view: string, data: Record<string, unknown>, result: { ok: boolean; errors?: FieldErrors; error?: string; html?: string; status?: number }) {
  if (wantsJson(req)) return res.status(result.ok ? 200 : (result.status ?? 422)).json({ ok: result.ok, errors: result.errors, error: result.error, html: result.html });
  return res.page(view, { ...data, errors: result.errors ?? {}, formError: result.error, success: result.ok ? result.html : undefined, values: result.ok ? {} : req.body }, result.ok ? 200 : (result.status ?? 422));
}

const successHtml = (title: string, body: string, extra = "") =>
  `<div class="alert alert-success" role="status"><p class="font-display text-xl text-ink">${escapeHtml(title)}</p><p class="mt-2">${escapeHtml(body)}</p>${extra}</div>`;

// ── Contact ───────────────────────────────────────────────────────────────────────────────────────
const contactSchema = z.object({
  name: str(191, "Name"),
  email,
  phone: optStr(40),
  company: optStr(191),
  inquiryType: z.string().refine((v) => INQUIRY_TYPES.includes(v), "Choose an enquiry type."),
  budget: optStr(60),
  timeline: optStr(60),
  message: str(5000, "Message").refine((v) => v.length >= 10, "Please write at least a sentence or two."),
  page: optStr(255),
});

async function contactData(res: Response) {
  const s = res.locals.settings as Settings;
  return {
    inquiryTypes: INQUIRY_TYPES,
    budgets: BUDGETS,
    timelines: TIMELINES,
    calendly: s.integrations.calendlyUrl,
    faqs: (await Q.getFaqs()).slice(0, 4),
    turnstile: turnstileConfigured,
  };
}

siteRouter.get("/contact", h(async (req, res) => {
  const pre = typeof req.query.type === "string" && INQUIRY_TYPES.includes(req.query.type) ? req.query.type : "";
  const subject = typeof req.query.subject === "string" ? req.query.subject.slice(0, 200) : "";
  await res.page("site/contact", { ...(await contactData(res)), values: { inquiryType: pre, message: subject ? `Regarding: ${subject}\n\n` : "" }, errors: {}, meta: meta(res, { title: "Contact", description: "Start a conversation about a software project, AI automation or corporate training." }) });
}));

siteRouter.post("/contact", upload.single("attachment"), h(async (req, res) => {
  const base = { ...(await contactData(res)), meta: meta(res, { title: "Contact" }) };
  const g = await gate(req, "contact");
  if (!g.ok) {
    if (g.silent) return respond(req, res, "site/contact", base, { ok: true, html: successHtml("Thank you.", "Your message has been sent.") });
    return respond(req, res, "site/contact", base, { ok: false, error: g.error, status: g.status });
  }
  const parsed = parse(contactSchema, req.body);
  if (!parsed.ok) return respond(req, res, "site/contact", base, { ok: false, errors: parsed.errors });
  const d = parsed.data;
  let attachmentId: number | null = null;
  if (req.file) {
    try {
      const m = await storeUpload(req.file.buffer, req.file.originalname, { folder: "private", maxImageMb: 8 });
      attachmentId = m.id;
    } catch (e) {
      return respond(req, res, "site/contact", base, { ok: false, errors: { attachment: e instanceof UploadError ? e.message : "Attachment couldn't be uploaded." } });
    }
  }
  // Store first — email is attempted afterwards and retried by cron if SMTP fails.
  const [r] = await db.insert(s.messages).values({
    ...d,
    attachmentId,
    referrer: (req.get("referer") ?? "").slice(0, 255) || null,
    country: (req.get("cf-ipcountry") ?? req.get("x-country-code") ?? "").slice(0, 8) || null,
    ipHash: req.ipHashed,
  });
  await trackEvent(req, "contact_submit", d.inquiryType);
  await sendEmail(d.email, T.contactAutoReply(d.name, d.inquiryType));
  await notifyAdmin(T.adminNewMessage({ ...d, id: r.insertId, adminLink: `${appUrl}${adminUrl(`/inbox/${r.insertId}`)}` }));
  respond(req, res, "site/contact", base, { ok: true, html: successHtml(`Thank you, ${d.name.split(" ")[0]}.`, "Your message is in. I reply to every enquiry within two working days — check your inbox for a confirmation.") });
}));

// ── Maintenance requests ──────────────────────────────────────────────────────────────────────────
const ticketSchema = z.object({
  clientName: str(191, "Name"),
  company: optStr(191),
  email,
  phone: optStr(40),
  projectId: z.string().optional().transform((v) => (v && /^\d+$/.test(v) ? Number(v) : null)),
  projectOther: optStr(191),
  issueType: z.enum(s.ISSUE_TYPES, { message: "Choose the type of issue." }),
  priority: z.enum(s.TICKET_PRIORITY, { message: "Choose a priority." }),
  description: str(8000, "Description").refine((v) => v.length >= 15, "Describe the issue in a little more detail."),
  affectedUrl: optStr(500).refine((v) => !v || /^https?:\/\//i.test(v), "Enter a full URL starting with https://"),
  contactMethod: z.enum(["email", "phone", "whatsapp"]).default("email"),
});

async function maintenanceData(res: Response) {
  const projects = await db
    .select({ id: s.projects.id, title: s.projects.title })
    .from(s.projects)
    .where(and(isNull(s.projects.deletedAt), eq(s.projects.status, "published")))
    .orderBy(asc(s.projects.title));
  return { projects, issueTypes: ISSUE_LABEL, priorities: s.TICKET_PRIORITY, turnstile: turnstileConfigured, meta: meta(res, { title: "Request maintenance", description: "Existing clients: report a bug, downtime, a content update or a feature request and track it with a ticket number." }) };
}

siteRouter.get("/maintenance-request", h(async (_req, res) => {
  await res.page("site/maintenance-request", { ...(await maintenanceData(res)), values: { priority: "normal", contactMethod: "email" }, errors: {} });
}));

siteRouter.post("/maintenance-request", upload.array("screenshots", 5), h(async (req, res) => {
  const base = await maintenanceData(res);
  const g = await gate(req, "maintenance");
  if (!g.ok) {
    if (g.silent) return respond(req, res, "site/maintenance-request", base, { ok: true, html: successHtml("Thank you.", "Your request has been received.") });
    return respond(req, res, "site/maintenance-request", base, { ok: false, error: g.error, status: g.status });
  }
  const parsed = parse(ticketSchema, req.body);
  if (!parsed.ok) return respond(req, res, "site/maintenance-request", base, { ok: false, errors: parsed.errors });
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const tooBig = files.find((f) => f.size > 5 * 1024 * 1024);
  if (tooBig) return respond(req, res, "site/maintenance-request", base, { ok: false, errors: { screenshots: `“${tooBig.originalname}” is larger than 5 MB.` } });
  const stored: number[] = [];
  for (const f of files) {
    try {
      stored.push((await storeUpload(f.buffer, f.originalname, { folder: "private", kinds: ["image"], maxImageMb: 5 })).id);
    } catch (e) {
      return respond(req, res, "site/maintenance-request", base, { ok: false, errors: { screenshots: e instanceof UploadError ? e.message : "A screenshot couldn't be uploaded." } });
    }
  }
  const d = parsed.data;
  const t = await createTicket({ ...d, ipHash: req.ipHashed });
  if (stored.length) await db.insert(s.ticketAttachments).values(stored.map((mediaId) => ({ ticketId: t.id, mediaId })));
  await trackEvent(req, "maintenance_submit", d.issueType);
  const issue = ISSUE_LABEL[d.issueType] ?? d.issueType;
  await sendEmail(d.email, T.ticketConfirmation({ ticketNo: t.ticketNo, name: d.clientName, priority: d.priority, issue }));
  await notifyAdmin(T.adminNewTicket({ ticketNo: t.ticketNo, name: d.clientName, company: d.company, priority: d.priority, issue, description: d.description, adminLink: `${appUrl}${adminUrl(`/tickets/${t.id}`)}` }));
  respond(req, res, "site/maintenance-request", base, {
    ok: true,
    html: successHtml(
      `Ticket ${t.ticketNo} created.`,
      "A confirmation is on its way to your inbox. Keep the ticket number — you'll need it with your email to check progress.",
      `<p class="mt-4"><a class="btn btn-outline btn-sm" href="/status?ticket=${encodeURIComponent(t.ticketNo)}">Check status</a></p>`,
    ),
  });
}));

// ── Ticket status ─────────────────────────────────────────────────────────────────────────────────
async function renderStatus(req: Request, res: Response, ticketNo: string, emailAddr: string, status = 200) {
  let ticket = null;
  let updates: Array<typeof s.ticketUpdates.$inferSelect> = [];
  let error = "";
  if (ticketNo && emailAddr) {
    const lim = await rateLimit("status", req.ipHashed, 20, 600);
    if (!lim.ok) error = "Too many lookups. Please wait a few minutes.";
    else {
      ticket = (await findTicket(ticketNo, emailAddr)) ?? null;
      if (!ticket) error = "No ticket matches that number and email address.";
      else updates = await db.select().from(s.ticketUpdates).where(and(eq(s.ticketUpdates.ticketId, ticket.id), eq(s.ticketUpdates.isPublic, true))).orderBy(asc(s.ticketUpdates.createdAt));
    }
  }
  await res.page(
    "site/status",
    { ticket, updates, error, ticketNo, email: emailAddr, labels: STATUS_LABEL, issues: ISSUE_LABEL, meta: meta(res, { title: ticket ? `Ticket ${ticket.ticketNo}` : "Check ticket status", noindex: true }) },
    error && ticketNo ? 404 : status,
  );
}
siteRouter.get("/status", h(async (req, res) => renderStatus(req, res, String(req.query.ticket ?? "").slice(0, 32), "")));
siteRouter.get("/status/:ticket", h(async (req, res) => renderStatus(req, res, String(req.params.ticket).slice(0, 32), "")));
siteRouter.post("/status", h(async (req, res) => renderStatus(req, res, String(req.body.ticket ?? "").slice(0, 32), String(req.body.email ?? "").slice(0, 191))));

// ── Newsletter (double opt-in) ────────────────────────────────────────────────────────────────────
siteRouter.post("/newsletter", h(async (req, res) => {
  const reply = (ok: boolean, message: string, status = 200) =>
    wantsJson(req) ? res.status(status).json({ ok, message, error: ok ? undefined : message }) : res.page("site/notice", { title: ok ? "Almost there" : "Couldn't subscribe", message, meta: meta(res, { title: "Newsletter", noindex: true }) }, status);
  const g = await gate(req, "newsletter");
  if (!g.ok) return g.silent ? reply(true, "Check your inbox to confirm.") : reply(false, g.error, g.status);
  const parsed = parse(z.object({ email }), req.body);
  if (!parsed.ok) return reply(false, "Enter a valid email address.", 422);
  const token = randomToken(24);
  const existing = (await db.select().from(s.subscribers).where(eq(s.subscribers.email, parsed.data.email)))[0];
  if (existing?.status === "confirmed") return reply(true, "You're already subscribed — thank you!");
  if (existing) await db.update(s.subscribers).set({ tokenHash: sha256(token), status: "pending" }).where(eq(s.subscribers.id, existing.id));
  else await db.insert(s.subscribers).values({ email: parsed.data.email, tokenHash: sha256(token), source: "footer" });
  await sendEmail(parsed.data.email, T.newsletterConfirm(`${appUrl}/newsletter/confirm?token=${token}`));
  reply(true, "Almost done — check your inbox and click the confirmation link.");
}));

siteRouter.get("/newsletter/confirm", h(async (req, res) => {
  const token = String(req.query.token ?? "");
  const sub = token ? (await db.select().from(s.subscribers).where(eq(s.subscribers.tokenHash, sha256(token))))[0] : undefined;
  if (sub && sub.status !== "unsubscribed") await db.update(s.subscribers).set({ status: "confirmed", confirmedAt: sub.confirmedAt ?? new Date() }).where(eq(s.subscribers.id, sub.id));
  await res.page("site/notice", {
    title: sub ? "You're subscribed." : "This link has expired",
    message: sub ? `Thank you. You can unsubscribe at any time from the link in every email.` : "Please subscribe again from the footer of any page.",
    extraHtml: sub ? `<p class="mt-4 text-sm"><a class="underline" href="/newsletter/unsubscribe?token=${encodeURIComponent(token)}">Unsubscribe</a></p>` : "",
    meta: meta(res, { title: "Newsletter", noindex: true }),
  });
}));

siteRouter.get("/newsletter/unsubscribe", h(async (req, res) => {
  const token = String(req.query.token ?? "");
  const sub = token ? (await db.select().from(s.subscribers).where(eq(s.subscribers.tokenHash, sha256(token))))[0] : undefined;
  if (sub) await db.update(s.subscribers).set({ status: "unsubscribed", unsubscribedAt: new Date() }).where(eq(s.subscribers.id, sub.id));
  await res.page("site/notice", { title: sub ? "You've been unsubscribed." : "Link not recognised", message: sub ? "You won't receive any more emails." : "If you keep receiving emails, reply to one and ask to be removed.", meta: meta(res, { title: "Newsletter", noindex: true }) });
}));

// ── Course registration & training requests ───────────────────────────────────────────────────────
const regSchema = z.object({
  name: str(191, "Name"),
  email,
  phone: optStr(40),
  company: optStr(191),
  seats: z.coerce.number().int().min(1, "At least one seat.").max(500).default(1),
  message: optStr(3000),
});

siteRouter.post("/courses/:slug/register", h(async (req, res) => {
  const course = (await Q.getCourses()).find((c) => c.slug === req.params.slug);
  const json = (ok: boolean, payload: Record<string, unknown>, status = 200) => res.status(status).json({ ok, ...payload });
  if (!course) return json(false, { error: "Course not found." }, 404);
  if (!course.registrationOpen) return json(false, { error: "Registration for this course is closed." }, 400);
  const g = await gate(req, "register");
  if (!g.ok) return g.silent ? json(true, { html: successHtml("Thank you.", "Registration received.") }) : json(false, { error: g.error }, g.status);
  const parsed = parse(regSchema, req.body);
  if (!parsed.ok) return json(false, { errors: parsed.errors }, 422);
  await db.insert(s.courseRegistrations).values({ ...parsed.data, courseId: course.id, subject: course.title, kind: "registration" });
  await trackEvent(req, "course_registration", course.slug);
  await sendEmail(parsed.data.email, T.courseRegistration({ name: parsed.data.name, course: course.title, kind: "registration" }));
  await notifyAdmin(T.adminNotice(`Course registration: ${course.title}`, [`${parsed.data.name} <${parsed.data.email}> registered ${parsed.data.seats} seat(s).`], `${appUrl}${adminUrl("/registrations")}`));
  json(true, { html: successHtml(`You're registered, ${parsed.data.name.split(" ")[0]}.`, "I'll confirm dates, fees and next steps by email.") });
}));

siteRouter.post("/training/:slug/request", h(async (req, res) => {
  const t = (await Q.getTrainings()).find((x) => x.slug === req.params.slug);
  const json = (ok: boolean, payload: Record<string, unknown>, status = 200) => res.status(status).json({ ok, ...payload });
  if (!t) return json(false, { error: "Training not found." }, 404);
  const g = await gate(req, "register");
  if (!g.ok) return g.silent ? json(true, { html: successHtml("Thank you.", "Request received.") }) : json(false, { error: g.error }, g.status);
  const parsed = parse(regSchema, req.body);
  if (!parsed.ok) return json(false, { errors: parsed.errors }, 422);
  await db.insert(s.courseRegistrations).values({ ...parsed.data, subject: t.title, kind: "training_request", meta: { trainingId: t.id } });
  await trackEvent(req, "course_registration", `request:${t.slug}`);
  await sendEmail(parsed.data.email, T.courseRegistration({ name: parsed.data.name, course: t.title, kind: "training_request" }));
  await notifyAdmin(T.adminNotice(`Training request: ${t.title}`, [`${parsed.data.name} (${parsed.data.company ?? "no company"}) <${parsed.data.email}> requested this training for ${parsed.data.seats} participant(s).`, parsed.data.message ?? ""], `${appUrl}${adminUrl("/registrations")}`));
  json(true, { html: successHtml("Request received.", "I'll be in touch within two working days to discuss dates, format and tailoring.") });
}));

// ── Private review submission ─────────────────────────────────────────────────────────────────────
async function findRequest(token: string) {
  if (!/^[\w-]{20,80}$/.test(token)) return undefined;
  return (
    await db
      .select()
      .from(s.reviewRequests)
      .where(and(eq(s.reviewRequests.tokenHash, sha256(token)), isNull(s.reviewRequests.usedAt), gt(s.reviewRequests.expiresAt, sql`NOW()`)))
      .limit(1)
  )[0];
}

async function reviewSubject(r: typeof s.reviewRequests.$inferSelect): Promise<string | null> {
  if (r.projectId) return (await db.select({ t: s.projects.title }).from(s.projects).where(eq(s.projects.id, r.projectId)))[0]?.t ?? null;
  if (r.trainingId) return (await db.select({ t: s.trainings.title }).from(s.trainings).where(eq(s.trainings.id, r.trainingId)))[0]?.t ?? null;
  return null;
}

siteRouter.get("/review/:token", h(async (req, res) => {
  const r = await findRequest(String(req.params.token));
  res.setHeader("X-Robots-Tag", "noindex");
  if (!r) return res.page("site/review", { invalid: true, meta: meta(res, { title: "Review link", noindex: true }) }, 404);
  if (!r.openedAt) await db.update(s.reviewRequests).set({ openedAt: new Date() }).where(eq(s.reviewRequests.id, r.id));
  await res.page("site/review", { r, subject: await reviewSubject(r), token: req.params.token, values: { name: r.name, rating: "5", consent: "1" }, errors: {}, meta: meta(res, { title: "Share a review", noindex: true }) });
}));

const reviewSchema = z.object({
  name: str(191, "Name"),
  role: optStr(191),
  company: optStr(191),
  rating: z.coerce.number().int().min(1, "Choose a rating.").max(5),
  quote: str(3000, "Review").refine((v) => v.length >= 20, "Please write at least a couple of sentences."),
  consent: checkbox,
});

siteRouter.post("/review/:token", h(async (req, res) => {
  const token = String(req.params.token);
  const r = await findRequest(token);
  if (!r) return res.page("site/review", { invalid: true, meta: meta(res, { title: "Review link", noindex: true }) }, 404);
  if (!checkCsrf(req)) return res.status(403).send("Session expired — reload the page.");
  const parsed = parse(reviewSchema, req.body);
  if (!parsed.ok) return res.page("site/review", { r, subject: await reviewSubject(r), token, values: req.body, errors: parsed.errors, meta: meta(res, { title: "Share a review", noindex: true }) }, 422);
  const d = parsed.data;
  const [t] = await db.insert(s.testimonials).values({
    authorName: d.name,
    authorRole: d.role,
    company: d.company,
    rating: d.rating,
    quote: d.quote,
    consent: d.consent,
    projectId: r.projectId,
    trainingId: r.trainingId,
    serviceTypeId: r.serviceTypeId,
    source: "direct",
    moderation: "pending",
    date: new Date().toISOString().slice(0, 10),
    isSample: false,
  });
  await db.update(s.reviewRequests).set({ usedAt: new Date(), testimonialId: t.insertId }).where(eq(s.reviewRequests.id, r.id));
  bust("testimonials");
  await sendEmail(r.email, T.reviewThanks(d.name));
  await notifyAdmin(T.adminNotice(`New review from ${d.name}`, [`${d.name} left a ${d.rating}-star review. It's waiting for moderation.`, d.consent ? "They consented to publication." : "They did NOT consent to publication."], `${appUrl}${adminUrl(`/content/testimonials/${t.insertId}`)}`));
  await res.page("site/review", { done: true, meta: meta(res, { title: "Thank you", noindex: true }) });
}));
