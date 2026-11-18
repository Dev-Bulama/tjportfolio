import path from "node:path";
import PDFDocument from "pdfkit";
import * as Q from "./public.js";
import { getSettings } from "./settings.js";
import { appUrl } from "../config/env.js";
import { groupBy, periodLabel, pub } from "../lib/util.js";
import { SKILL_LABELS } from "../lib/view-helpers.js";

const font = (pkg: string, file: string) => path.resolve(process.cwd(), "node_modules", pkg, "files", file);
const NAVY = "#0F2A47";
const GOLD = "#B8925A";
const INK = "#0B1A2B";
const BODY = "#33414F";
const MUTED = "#5F6A78";

/** Builds a clean, branded CV from profile + experience + skills + certifications + trainings (brief §4.3.11). */
export async function generateCvPdf(): Promise<Buffer> {
  const [s, about, certs, trainings] = await Promise.all([getSettings(), Q.getAbout(), Q.getCertifications(), Q.getTrainings()]);
  const doc = new PDFDocument({ size: "A4", margins: { top: 54, bottom: 54, left: 56, right: 56 }, info: { Title: `${s.profile.fullName} — CV`, Author: s.profile.fullName } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((r) => doc.on("end", () => r(Buffer.concat(chunks))));
  try {
    doc.registerFont("serif", font("@fontsource/fraunces", "fraunces-latin-600-normal.woff"));
    doc.registerFont("serif-italic", font("@fontsource/fraunces", "fraunces-latin-400-italic.woff"));
    doc.registerFont("sans", font("@fontsource/inter", "inter-latin-400-normal.woff"));
    doc.registerFont("sans-bold", font("@fontsource/inter", "inter-latin-600-normal.woff"));
  } catch {
    doc.registerFont("serif", "Times-Bold");
    doc.registerFont("serif-italic", "Times-Italic");
    doc.registerFont("sans", "Helvetica");
    doc.registerFont("sans-bold", "Helvetica-Bold");
  }
  const W = doc.page.width - 112;
  const section = (title: string) => {
    if (doc.y > doc.page.height - 140) doc.addPage();
    doc.moveDown(1.1);
    doc.font("sans-bold").fontSize(8.5).fillColor(GOLD).text(title.toUpperCase(), { characterSpacing: 1.6 });
    doc.moveTo(56, doc.y + 3).lineTo(56 + W, doc.y + 3).lineWidth(0.6).strokeColor(GOLD).stroke();
    doc.moveDown(0.7);
  };

  // Header
  doc.font("serif").fontSize(26).fillColor(INK).text(s.profile.fullName);
  doc.font("serif-italic").fontSize(11.5).fillColor(BODY).text(s.profile.headline, { width: W });
  doc.moveDown(0.4);
  const contact = [s.profile.location, pub(s.profile.email), pub(s.profile.phone), appUrl.replace(/^https?:\/\//, "")].filter(Boolean).join("   ·   ");
  doc.font("sans").fontSize(9).fillColor(MUTED).text(contact, { width: W });

  section("Profile");
  doc.font("sans").fontSize(10).fillColor(BODY).text(s.profile.shortBio, { width: W, lineGap: 2.5, align: "left" });

  if (about.experiences.length) {
    section("Experience");
    for (const e of about.experiences) {
      if (doc.y > doc.page.height - 110) doc.addPage();
      const period = e.startDate || e.endDate ? periodLabel(e.startDate, e.endDate, e.isCurrent) : (pub(e.periodLabel) ?? (e.isCurrent ? "Present" : ""));
      const y = doc.y;
      doc.font("sans-bold").fontSize(10.5).fillColor(INK).text(e.role, 56, y, { width: W - 120 });
      if (period) doc.font("sans").fontSize(9).fillColor(MUTED).text(period, 56 + W - 120, y, { width: 120, align: "right" });
      doc.font("sans").fontSize(9.5).fillColor(NAVY).text([e.organization, e.location].filter(Boolean).join(" · "), 56, doc.y, { width: W });
      if (e.description) doc.font("sans").fontSize(9.5).fillColor(BODY).text(e.description, { width: W, lineGap: 2 });
      doc.moveDown(0.6);
    }
  }

  if (about.skills.length) {
    section("Skills");
    for (const [cat, list] of groupBy(about.skills, (k) => k.category)) {
      doc.font("sans-bold").fontSize(9.5).fillColor(INK).text(`${SKILL_LABELS[cat] ?? cat}: `, { continued: true });
      doc.font("sans").fillColor(BODY).text(list.map((k) => k.name).join(", "), { width: W, lineGap: 2 });
      doc.moveDown(0.25);
    }
  }

  if (certs.length) {
    section("Certifications");
    for (const c of certs) doc.font("sans").fontSize(9.5).fillColor(BODY).text(`${c.name} — ${c.issuer}${c.issueDate ? ` (${c.issueDate.slice(0, 4)})` : ""}`, { width: W });
  }

  if (trainings.length) {
    section("Trainings delivered");
    for (const t of trainings) {
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.font("sans-bold").fontSize(9.5).fillColor(INK).text(t.title, { width: W, continued: Boolean(t.client || t.durationLabel) });
      if (t.client || t.durationLabel) doc.font("sans").fillColor(MUTED).text(`  ${[t.client, t.durationLabel].filter(Boolean).join(" · ")}`);
    }
  }

  if (about.education.length) {
    section("Education");
    for (const e of about.education) doc.font("sans").fontSize(9.5).fillColor(BODY).text(`${e.qualification}${e.field ? `, ${e.field}` : ""} — ${e.institution}${e.endYear ? ` (${e.endYear})` : ""}`, { width: W });
  }
  if (about.press.length) {
    section("Speaking & press");
    for (const p of about.press) doc.font("sans").fontSize(9.5).fillColor(BODY).text(`${p.title}${p.outlet ? ` — ${p.outlet}` : ""}${p.date ? ` (${p.date.slice(0, 4)})` : ""}`, { width: W });
  }
  doc.font("sans").fontSize(8).fillColor(MUTED).text(`Generated from ${appUrl.replace(/^https?:\/\//, "")} on ${new Date().toISOString().slice(0, 10)}.`, 56, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
  doc.end();
  return done;
}
