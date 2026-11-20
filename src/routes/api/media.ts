import { Router } from "express";
import { eq, like } from "drizzle-orm";
import { db } from "../../db/index.js";
import { media } from "../../db/schema/index.js";
import { driver } from "../../lib/storage/index.js";

export const mediaRouter = Router();

const PREVIEWABLE = /^(image\/(jpeg|png|webp|gif|avif)|application\/pdf)$/;
const VARIANT = /-w\d+\.webp$/;
const COLS = { mime: media.mime, driver: media.driver, key: media.key, name: media.originalName, deletedAt: media.deletedAt, folder: media.folder };

/**
 * Serves uploads stored outside the web root (brief §9): correct Content-Type, nosniff,
 * ETag, long cache. Keys look like `2026/11/<random>.jpg`; WebP variants `2026/11/<random>-w640.webp`.
 */
mediaRouter.get(/^\/media\/(.+)$/, async (req, res, next) => {
  try {
    const key = (req.params as unknown as string[])[0]!;
    if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/i.test(key) || key.includes("..")) return void res.status(404).end();
    const isVariant = VARIANT.test(key);
    const parent = isVariant
      ? (await db.select(COLS).from(media).where(like(media.key, `${key.replace(VARIANT, "").replace(/[%_\\]/g, "\\$&")}.%`)).limit(1))[0]
      : (await db.select(COLS).from(media).where(eq(media.key, key)).limit(1))[0];
    // "private" folder = ticket screenshots and message attachments: never public.
    if (!parent || parent.folder === "private") return void res.status(404).end();
    const obj = await driver(parent.driver).get(key);
    if (!obj) return void res.status(404).end();
    if (obj.etag && req.headers["if-none-match"] === obj.etag) return void res.status(304).end();
    const type = isVariant ? "image/webp" : parent.mime;
    const safeName = parent.name.replace(/[^\w.-]+/g, "_");
    res.setHeader("Content-Type", type);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", parent.deletedAt ? "no-store" : "public, max-age=31536000, immutable");
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (obj.etag) res.setHeader("ETag", obj.etag);
    if (obj.size) res.setHeader("Content-Length", String(obj.size));
    if (type === "application/pdf") res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    else if (!PREVIEWABLE.test(type)) res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    obj.body.on("error", next).pipe(res);
  } catch (e) {
    next(e);
  }
});
