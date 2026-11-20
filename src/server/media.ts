import { inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { media, type MediaVariant } from "../db/schema/index.js";
import { env } from "../config/env.js";
import { escapeHtml } from "../lib/util.js";

export type MediaRow = typeof media.$inferSelect;
export type Img = Pick<MediaRow, "id" | "key" | "driver" | "mime" | "width" | "height" | "blurDataUrl" | "alt" | "caption" | "credit" | "originalName" | "size"> & {
  variants: MediaVariant[] | null;
};

export function fileUrl(driver: "local" | "s3", key: string): string {
  if (driver === "s3" && env.S3_PUBLIC_URL) return `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  return `/media/${key}`;
}

export function mediaUrl(m: Pick<Img, "driver" | "key" | "variants"> | null | undefined, width?: number): string {
  if (!m) return "";
  if (width && m.variants?.length) {
    const v = [...m.variants].sort((a, b) => a.width - b.width).find((x) => x.width >= width) ?? m.variants.at(-1)!;
    return fileUrl(m.driver, v.key);
  }
  return fileUrl(m.driver, m.key);
}

export function isImage(m: Pick<Img, "mime"> | null | undefined): boolean {
  return Boolean(m && m.mime.startsWith("image/"));
}

type ImgOpts = {
  sizes?: string;
  cls?: string;
  alt?: string;
  eager?: boolean;
  width?: number;
  aspect?: string; // e.g. "16/10" → object-cover box
  imgCls?: string;
};

/** Responsive <img> with srcset from pre-built WebP variants, intrinsic size and a blur placeholder. */
export function imgTag(m: Img | null | undefined, o: ImgOpts = {}): string {
  if (!m) return "";
  const alt = escapeHtml(o.alt ?? m.alt ?? "");
  const src = escapeHtml(mediaUrl(m, o.width ?? 1280));
  const srcset = m.variants?.length
    ? m.variants.map((v) => `${escapeHtml(fileUrl(m.driver, v.key))} ${v.width}w`).join(", ")
    : "";
  const w = m.width ?? undefined;
  const h = m.height ?? undefined;
  const blur = m.blurDataUrl ? ` style="background-image:url(${m.blurDataUrl});background-size:cover;background-position:center"` : "";
  const fit = o.aspect ? ` style="aspect-ratio:${o.aspect}"` : "";
  const img = `<img src="${src}"${srcset ? ` srcset="${srcset}" sizes="${escapeHtml(o.sizes ?? "100vw")}"` : ""} alt="${alt}"${w ? ` width="${w}"` : ""}${h ? ` height="${h}"` : ""} loading="${o.eager ? "eager" : "lazy"}" decoding="async"${o.eager ? ' fetchpriority="high"' : ""} class="${escapeHtml(o.imgCls ?? (o.aspect ? "h-full w-full object-cover" : "h-auto w-full"))}"${blur}>`;
  return o.aspect ? `<div class="${escapeHtml(o.cls ?? "")} overflow-hidden"${fit}>${img}</div>` : o.cls ? `<div class="${escapeHtml(o.cls)}">${img}</div>` : img;
}

const COLS = {
  id: media.id,
  key: media.key,
  driver: media.driver,
  mime: media.mime,
  width: media.width,
  height: media.height,
  blurDataUrl: media.blurDataUrl,
  alt: media.alt,
  caption: media.caption,
  credit: media.credit,
  originalName: media.originalName,
  size: media.size,
  variants: media.variants,
};

/** Batch-load media rows for a list of ids (nulls ignored). */
export async function mediaMap(ids: Array<number | null | undefined>): Promise<Map<number, Img>> {
  const uniq = [...new Set(ids.filter((x): x is number => typeof x === "number"))];
  if (!uniq.length) return new Map();
  const rows = await db.select(COLS).from(media).where(inArray(media.id, uniq));
  return new Map(rows.map((r) => [r.id, r as Img]));
}
