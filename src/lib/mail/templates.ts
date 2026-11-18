import path from "node:path";
import ejs from "ejs";
import { appUrl } from "../../config/env.js";

/** Content model for every branded email (one React-Email-style layout, many messages). */
export type EmailContent = {
  subject: string;
  preheader?: string;
  heading: string;
  paragraphs: string[];
  button?: { label: string; url: string };
  details?: Array<[string, string]>;
  quote?: string;
  footnote?: string;
};

const layout = path.resolve(process.cwd(), "views/emails/layout.ejs");

export async function renderEmail(c: EmailContent): Promise<{ subject: string; html: string; text: string }> {
  const html = await ejs.renderFile(layout, { ...c, appUrl, year: new Date().getUTCFullYear() });
  const text = [
    c.heading,
    "",
    ...c.paragraphs,
    ...(c.quote ? ["", `"${c.quote}"`] : []),
    ...(c.details?.length ? ["", ...c.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(c.button ? ["", `${c.button.label}: ${c.button.url}`] : []),
    ...(c.footnote ? ["", c.footnote] : []),
    "",
    "— Tijani Bulama",
    appUrl,
  ].join("\n");
  return { subject: c.subject, html, text };
}

const u = (p: string) => `${appUrl}${p}`;

export const T = {
  contactAutoReply: (name: string, inquiry: string): EmailContent => ({
    subject: "Thanks — I've received your message",
    preheader: "I reply to every enquiry within two working days.",
    heading: `Thank you, ${name}.`,
    paragraphs: [
      `Your ${inquiry.toLowerCase()} enquiry has reached me. I read every message personally and reply within two working days.`,
      "If it's urgent, reply to this email and mention a phone number and a good time to call.",
    ],
    button: { label: "See recent work", url: u("/work") },
  }),
  adminNewMessage: (m: { name: string; email: string; inquiryType: string; message: string; id: number; adminLink: string }): EmailContent => ({
    subject: `New enquiry: ${m.inquiryType} — ${m.name}`,
    heading: "New contact message",
    paragraphs: [`${m.name} <${m.email}> sent a ${m.inquiryType} enquiry.`],
    quote: m.message.slice(0, 1200),
    button: { label: "Open in inbox", url: m.adminLink },
  }),
  ticketConfirmation: (t: { ticketNo: string; name: string; priority: string; issue: string }): EmailContent => ({
    subject: `Ticket ${t.ticketNo} received`,
    preheader: "Keep this ticket number to check progress.",
    heading: `We've logged your request, ${t.name}.`,
    paragraphs: ["Your maintenance request has been received and is in the queue. You'll get an email whenever there's an update."],
    details: [
      ["Ticket", t.ticketNo],
      ["Issue", t.issue],
      ["Priority", t.priority],
    ],
    button: { label: "Check ticket status", url: u(`/status?ticket=${encodeURIComponent(t.ticketNo)}`) },
    footnote: "To check status you'll need this ticket number and the email address you used.",
  }),
  adminNewTicket: (t: { ticketNo: string; name: string; company?: string | null; priority: string; issue: string; description: string; adminLink: string }): EmailContent => ({
    subject: `[${t.priority.toUpperCase()}] ${t.ticketNo} — ${t.issue}`,
    heading: "New maintenance ticket",
    paragraphs: [`${t.name}${t.company ? ` (${t.company})` : ""} opened ${t.ticketNo}.`],
    quote: t.description.slice(0, 1200),
    button: { label: "Open ticket", url: t.adminLink },
  }),
  ticketUpdate: (t: { ticketNo: string; name: string; status: string; body?: string | null }): EmailContent => ({
    subject: `Update on ${t.ticketNo}: ${t.status}`,
    heading: `There's an update on your ticket, ${t.name}.`,
    paragraphs: [`Status: ${t.status}.`],
    ...(t.body ? { quote: t.body } : {}),
    button: { label: "View ticket", url: u(`/status?ticket=${encodeURIComponent(t.ticketNo)}`) },
  }),
  reviewRequest: (r: { name: string; link: string; subject?: string | null; message?: string | null; days: number }): EmailContent => ({
    subject: "Would you share a short review?",
    heading: `Hello ${r.name},`,
    paragraphs: [
      r.message ||
        `Thank you for working with me${r.subject ? ` on ${r.subject}` : ""}. Would you take two minutes to share a short review? It helps other organisations decide whether I'm the right fit.`,
      `The link below is personal to you and expires in ${r.days} days.`,
    ],
    button: { label: "Write a review", url: r.link },
  }),
  reviewThanks: (name: string): EmailContent => ({
    subject: "Thank you for your review",
    heading: `Thank you, ${name}.`,
    paragraphs: ["I really appreciate you taking the time. Your review will appear on the site once it has been checked — and only if you gave consent to publish it."],
  }),
  passwordReset: (name: string, link: string): EmailContent => ({
    subject: "Reset your admin password",
    heading: `Hi ${name},`,
    paragraphs: ["Someone (hopefully you) asked to reset the password for your admin account. This link works once and expires in 30 minutes.", "If you didn't ask for this, you can ignore this email — your password won't change."],
    button: { label: "Reset password", url: link },
  }),
  twoFactorEnabled: (name: string): EmailContent => ({
    subject: "Two-factor authentication is on",
    heading: `Hi ${name},`,
    paragraphs: ["Two-factor authentication was just enabled on your admin account. Keep your recovery codes somewhere safe.", "If this wasn't you, reset your password immediately and contact the site owner."],
  }),
  lockoutAlert: (email: string, until: string): EmailContent => ({
    subject: "Admin login locked after repeated failures",
    heading: "Repeated failed logins",
    paragraphs: [`The admin account ${email} was locked after 5 failed sign-in attempts. It unlocks automatically at ${until}.`, "If this wasn't you or a teammate, consider changing the password."],
  }),
  newsletterConfirm: (link: string): EmailContent => ({
    subject: "Confirm your subscription",
    heading: "One more step",
    paragraphs: ["Please confirm you'd like to receive occasional notes on engineering, AI automation and training. If you didn't sign up, ignore this email."],
    button: { label: "Confirm subscription", url: link },
  }),
  courseRegistration: (r: { name: string; course: string; kind: string }): EmailContent => ({
    subject: r.kind === "training_request" ? `Training request received: ${r.course}` : `Registration received: ${r.course}`,
    heading: `Thank you, ${r.name}.`,
    paragraphs: [
      r.kind === "training_request"
        ? `Your request to run “${r.course}” for your team has been received. I'll be in touch within two working days to discuss dates, format and tailoring.`
        : `Your interest in “${r.course}” has been registered. I'll confirm dates, fees and next steps by email.`,
    ],
    button: { label: "Browse courses", url: u("/courses") },
  }),
  adminNotice: (subject: string, lines: string[], link?: string): EmailContent => ({
    subject,
    heading: subject,
    paragraphs: lines,
    ...(link ? { button: { label: "Open admin", url: link } } : {}),
  }),
};
