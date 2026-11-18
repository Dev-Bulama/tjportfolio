import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as util from "./util.js";
import { icon } from "./icons.js";
import { imgTag, mediaUrl, isImage, fileUrl } from "../server/media.js";
import { adminUrl } from "../config/env.js";

const publicDir = path.resolve(process.cwd(), "public");
const versions = new Map<string, string>();

/** Cache-busted asset URL: /assets/app.css?v=<content hash>. */
export function asset(p: string): string {
  let v = versions.get(p);
  if (!v) {
    try {
      v = crypto.createHash("md5").update(fs.readFileSync(path.join(publicDir, p))).digest("hex").slice(0, 10);
    } catch {
      v = "dev";
    }
    if (process.env.NODE_ENV === "production") versions.set(p, v);
  }
  return `${p}?v=${v}`;
}

/** Star rating as accessible text + glyphs. */
export function stars(n: number): string {
  const r = util.clamp(Math.round(n), 0, 5);
  return `<span class="stars" role="img" aria-label="${r} out of 5 stars">${"★".repeat(r)}<span class="opacity-30">${"★".repeat(5 - r)}</span></span>`;
}

export function json(v: unknown): string {
  // Safe for <script type="application/ld+json"> and data attributes.
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function attr(v: unknown): string {
  return util.escapeHtml(v);
}

export function qs(base: Record<string, unknown>, patch: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const SKILL_LABELS: Record<string, string> = {
  languages: "Languages",
  frameworks: "Frameworks",
  databases: "Databases",
  cloud: "Cloud & Infrastructure",
  ai_data: "AI & Data",
  methodologies: "Methodologies",
  training: "Training & Content",
  tools: "Tools",
};

export const viewHelpers = {
  skillLabel: (k: string) => SKILL_LABELS[k] ?? k,
  ...util,
  icon,
  img: imgTag,
  mediaUrl,
  fileUrl,
  isImage,
  asset,
  stars,
  json,
  attr,
  qs,
  A: adminUrl,
  year: () => new Date().getUTCFullYear(),
};
