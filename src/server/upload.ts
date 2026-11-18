import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { media, type MediaVariant } from "../db/schema/index.js";
import { env } from "../config/env.js";
import { driver } from "../lib/storage/index.js";
import { sniff } from "../lib/magic.js";
import { logger } from "../lib/logger.js";
import { bust } from "../lib/cache.js";
import { getSettings } from "./settings.js";

export const VARIANT_WIDTHS = [320, 640, 960, 1280, 1920];
type Sharp = typeof import("sharp").default;
let sharpMod: Sharp | null | undefined;
let sharpError: string | null = null;

/** Loads sharp lazily; if the native binary is missing on the host, uploads still work without variants (PLAN D4). */
async function getSharp(): Promise<Sharp | null> {
  if (sharpMod !== undefined) return sharpMod;
  try {
    sharpMod = (await import("sharp")).default;
    sharpMod.cache(false);
    sharpMod.concurrency(1);
  } catch (e) {
    sharpMod = null;
    sharpError = (e as Error).message;
    logger.warn({ err: sharpError }, "sharp unavailable — storing originals without resizing");
  }
  return sharpMod;
}
export const sharpStatus = () => ({ loaded: sharpMod !== null && sharpMod !== undefined, error: sharpError });

export class UploadError extends Error {
  status = 400;
}

export type UploadOpts = { folder?: string; userId?: number; alt?: string; kinds?: Array<"image" | "pdf">; maxImageMb?: number; albumId?: number | null };

function newKey(ext: string): string {
  const d = new Date();
  return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${crypto.randomBytes(12).toString("base64url").toLowerCase().replace(/[^a-z0-9]/g, "x")}.${ext}`;
}

type Processed = { body: Buffer; width: number | null; height: number | null; blur: string | null; variants: Array<{ width: number; height: number; body: Buffer }> };

async function processImage(buf: Buffer, mime: string): Promise<Processed> {
  const sharp = await getSharp();
  if (!sharp || mime === "image/gif") {
    // GIFs keep animation; without sharp we store as-is.
    let width: number | null = null;
    let height: number | null = null;
    if (sharp) {
      const m = await sharp(buf, { animated: true }).metadata();
      width = m.width ?? null;
      height = m.pageHeight ?? m.height ?? null;
    }
    return { body: buf, width, height, blur: null, variants: [] };
  }
  // rotate() applies EXIF orientation; output without withMetadata() strips EXIF incl. GPS.
  const base = sharp(buf, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
  const fmt = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/avif" ? "avif" : "jpeg";
  const cleaned = await base
    .clone()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .toFormat(fmt, fmt === "jpeg" ? { quality: 86, mozjpeg: true } : fmt === "webp" ? { quality: 86 } : {})
    .toBuffer({ resolveWithObject: true });
  const width = cleaned.info.width;
  const height = cleaned.info.height;
  const variants: Processed["variants"] = [];
  for (const w of VARIANT_WIDTHS) {
    if (w >= width && variants.length) break;
    const out = await sharp(cleaned.data).resize({ width: Math.min(w, width) }).webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
    variants.push({ width: out.info.width, height: out.info.height, body: out.data });
  }
  const tiny = await sharp(cleaned.data).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  return { body: cleaned.data, width, height, blur: `data:image/webp;base64,${tiny.toString("base64")}`, variants };
}

/** Validates (magic bytes, size), processes and stores an upload; returns the media row. */
export async function storeUpload(buf: Buffer, originalName: string, o: UploadOpts = {}) {
  const s = await getSettings();
  const type = sniff(buf);
  const kinds = o.kinds ?? ["image", "pdf"];
  if (!type || !kinds.includes(type.kind)) {
    throw new UploadError(`“${originalName}” isn't an allowed file type. Use ${kinds.includes("pdf") ? "JPG, PNG, WebP, GIF, AVIF or PDF" : "JPG, PNG, WebP, GIF or AVIF"}.`);
  }
  const maxMb = type.kind === "pdf" ? s.site.pdfMaxMb : (o.maxImageMb ?? s.site.imageMaxMb);
  if (buf.length > maxMb * 1024 * 1024) throw new UploadError(`“${originalName}” is larger than ${maxMb} MB.`);

  const key = newKey(type.ext);
  const store = driver();
  let processed: Processed = { body: buf, width: null, height: null, blur: null, variants: [] };
  if (type.kind === "image") {
    try {
      processed = await processImage(buf, type.mime);
    } catch (e) {
      throw new UploadError(`“${originalName}” couldn't be read as an image (${(e as Error).message}).`);
    }
  }
  await store.put(key, processed.body, type.mime);
  const variants: MediaVariant[] = [];
  for (const v of processed.variants) {
    const vk = key.replace(/\.[a-z0-9]+$/, `-w${v.width}.webp`);
    await store.put(vk, v.body, "image/webp");
    variants.push({ width: v.width, height: v.height, key: vk, size: v.body.length });
  }
  const [r] = await db.insert(media).values({
    driver: store.name,
    key,
    originalName: originalName.replace(/[^\w.\- ()]+/g, "_").slice(0, 255) || `upload.${type.ext}`,
    mime: type.mime,
    size: processed.body.length,
    width: processed.width,
    height: processed.height,
    blurDataUrl: processed.blur,
    variants: variants.length ? variants : null,
    alt: o.alt?.slice(0, 255) || null,
    checksum: crypto.createHash("sha256").update(buf).digest("hex"),
    folder: o.folder ?? "library",
    albumId: o.albumId ?? null,
    createdBy: o.userId ?? null,
  });
  bust("media");
  return (await db.select().from(media).where(eq(media.id, r.insertId)))[0]!;
}

/** Replace a file's content while keeping its id (so every reference keeps working). */
export async function replaceUpload(id: number, buf: Buffer, originalName: string) {
  const old = (await db.select().from(media).where(eq(media.id, id)))[0];
  if (!old) throw new UploadError("File not found.");
  const kind = old.mime === "application/pdf" ? "pdf" : "image";
  const fresh = await storeUpload(buf, originalName, { kinds: [kind], folder: old.folder });
  await db
    .update(media)
    .set({ key: fresh.key, driver: fresh.driver, mime: fresh.mime, size: fresh.size, width: fresh.width, height: fresh.height, blurDataUrl: fresh.blurDataUrl, variants: fresh.variants, checksum: fresh.checksum, originalName: fresh.originalName })
    .where(eq(media.id, id));
  await db.delete(media).where(eq(media.id, fresh.id));
  await deleteFiles(old);
  bust("all");
  return id;
}

export async function deleteFiles(m: Pick<typeof media.$inferSelect, "driver" | "key" | "variants">): Promise<void> {
  const d = driver(m.driver);
  await d.delete(m.key).catch(() => {});
  for (const v of m.variants ?? []) await d.delete(v.key).catch(() => {});
}

export const storageDriverName = () => env.STORAGE_DRIVER;
