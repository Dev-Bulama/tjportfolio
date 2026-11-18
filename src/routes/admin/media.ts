import { Router } from "express";
import multer from "multer";
import { and, desc, eq, inArray, isNotNull, isNull, like, notInArray, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { albums, media, mediaUsages } from "../../db/schema/index.js";
import { adminUrl } from "../../config/env.js";
import { checkCsrf } from "../../middleware/context.js";
import { storeUpload, replaceUpload, deleteFiles, UploadError } from "../../server/upload.js";
import { mediaUrl, isImage, type Img } from "../../server/media.js";
import { audit } from "../../lib/audit.js";
import { bust } from "../../lib/cache.js";
import { sanitizePlain } from "../../lib/sanitize.js";
import { ah, assertCan, flash, wantsJson } from "./mw.js";

export const mediaAdminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 20, fields: 20 } });
const PAGE = 48;

function toJson(m: Img & { createdAt?: Date; albumId?: number | null; folder?: string }) {
  return { id: m.id, url: mediaUrl(m), thumb: isImage(m) ? mediaUrl(m, 320) : "", name: m.originalName, mime: m.mime, size: m.size, width: m.width, height: m.height, alt: m.alt ?? "", caption: m.caption ?? "", credit: m.credit ?? "", isImage: isImage(m) };
}

function filters(q: Record<string, unknown>) {
  const where = [eq(media.folder, "library")];
  const trash = q.trash === "1";
  where.push(trash ? isNotNull(media.deletedAt) : isNull(media.deletedAt));
  const term = typeof q.q === "string" && q.q ? `%${q.q.replace(/[%_\\]/g, "\\$&").slice(0, 80)}%` : null;
  if (term) where.push(or(like(media.originalName, term), like(media.alt, term), like(media.caption, term))!);
  if (q.type === "image") where.push(like(media.mime, "image/%"));
  if (q.type === "pdf") where.push(eq(media.mime, "application/pdf"));
  if (q.album && /^\d+$/.test(String(q.album))) where.push(eq(media.albumId, Number(q.album)));
  if (q.unused === "1") where.push(notInArray(media.id, db.select({ id: mediaUsages.mediaId }).from(mediaUsages)), isNull(media.albumId));
  if (q.noalt === "1") where.push(like(media.mime, "image/%"), or(isNull(media.alt), eq(media.alt, ""))!);
  return and(...where);
}

mediaAdminRouter.get("/media.json", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const page = Math.max(1, Number(req.query.page) || 1);
  const rows = await db.select().from(media).where(filters(req.query)).orderBy(desc(media.id)).limit(PAGE + 1).offset((page - 1) * PAGE);
  res.json({ ok: true, items: rows.slice(0, PAGE).map((r) => toJson(r as Img)), more: rows.length > PAGE });
}));

mediaAdminRouter.get("/media", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const page = Math.max(1, Number(req.query.page) || 1);
  const where = filters(req.query);
  const [rows, total, albumList, usageCounts] = await Promise.all([
    db.select().from(media).where(where).orderBy(desc(media.id)).limit(PAGE).offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)` }).from(media).where(where),
    db.select({ id: albums.id, title: albums.title }).from(albums).where(isNull(albums.deletedAt)),
    db.select({ id: mediaUsages.mediaId, n: sql<number>`count(*)` }).from(mediaUsages).groupBy(mediaUsages.mediaId),
  ]);
  const usage = new Map(usageCounts.map((u) => [u.id, Number(u.n)]));
  await res.page("admin/media/index", {
    layout: "admin",
    title: "Media library",
    items: rows,
    usage,
    total: Number(total[0]?.n ?? 0),
    page,
    pages: Math.max(1, Math.ceil(Number(total[0]?.n ?? 0) / PAGE)),
    albumList,
    q: req.query,
  });
}));

mediaAdminRouter.post("/media/upload", upload.array("files", 20), ah(async (req, res) => {
  if (!checkCsrf(req)) return res.status(403).json({ ok: false, error: "Session expired — reload the page." });
  assertCan(req, "create", "content");
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const albumId = /^\d+$/.test(String(req.body.albumId ?? "")) ? Number(req.body.albumId) : null;
  const out: unknown[] = [];
  const errors: string[] = [];
  for (const f of files) {
    try {
      const m = await storeUpload(f.buffer, f.originalname, { userId: req.user!.id, albumId, alt: typeof req.body.alt === "string" ? req.body.alt : undefined });
      out.push(toJson(m as Img));
    } catch (e) {
      errors.push(e instanceof UploadError ? e.message : `“${f.originalname}”: upload failed.`);
    }
  }
  if (out.length) await audit(req.user, "upload", "media", null, { summary: `Uploaded ${out.length} file(s)`, ipHash: req.ipHashed });
  res.status(out.length || !files.length ? 200 : 400).json({ ok: errors.length === 0, items: out, errors });
}));

mediaAdminRouter.get("/media/:id", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const m = (await db.select().from(media).where(eq(media.id, Number(req.params.id))))[0];
  if (!m) return res.redirect(adminUrl("/media"));
  const usages = await db.select().from(mediaUsages).where(eq(mediaUsages.mediaId, m.id));
  const album = m.albumId ? (await db.select({ id: albums.id, title: albums.title }).from(albums).where(eq(albums.id, m.albumId)))[0] : undefined;
  await res.page("admin/media/show", { layout: "admin", title: m.originalName, m, usages, album });
}));

mediaAdminRouter.post("/media/:id", ah(async (req, res) => {
  assertCan(req, "update", "content");
  const id = Number(req.params.id);
  const before = (await db.select().from(media).where(eq(media.id, id)))[0];
  if (!before) return res.redirect(adminUrl("/media"));
  const patch = {
    alt: sanitizePlain(String(req.body.alt ?? "")).slice(0, 255) || null,
    caption: sanitizePlain(String(req.body.caption ?? "")).slice(0, 500) || null,
    credit: sanitizePlain(String(req.body.credit ?? "")).slice(0, 191) || null,
  };
  if (before.mime.startsWith("image/") && !patch.alt) {
    if (wantsJson(req)) return res.status(422).json({ ok: false, errors: { alt: "Alt text is required for images." } });
    flash(res, "error", "Alt text is required for images — describe what the image shows.");
    return res.redirect(adminUrl(`/media/${id}`));
  }
  await db.update(media).set(patch).where(eq(media.id, id));
  await audit(req.user, "update", "media", id, { before, after: { ...before, ...patch }, ipHash: req.ipHashed });
  bust("all");
  if (wantsJson(req)) return res.json({ ok: true });
  flash(res, "success", "File details saved.");
  res.redirect(adminUrl(`/media/${id}`));
}));

mediaAdminRouter.post("/media/:id/replace", upload.single("file"), ah(async (req, res) => {
  if (!checkCsrf(req)) return res.status(403).send("Session expired — reload the page.");
  assertCan(req, "update", "content");
  const id = Number(req.params.id);
  if (!req.file) {
    flash(res, "error", "Choose a file to upload.");
    return res.redirect(adminUrl(`/media/${id}`));
  }
  try {
    await replaceUpload(id, req.file.buffer, req.file.originalname);
    await audit(req.user, "replace", "media", id, { summary: `Replaced file with ${req.file.originalname}`, ipHash: req.ipHashed });
    flash(res, "success", "File replaced. Every page using it now shows the new version.");
  } catch (e) {
    flash(res, "error", e instanceof UploadError ? e.message : "Replace failed.");
  }
  res.redirect(adminUrl(`/media/${id}`));
}));

mediaAdminRouter.post("/media/:id/trash", ah(async (req, res) => {
  assertCan(req, "delete", "content");
  const id = Number(req.params.id);
  await db.update(media).set({ deletedAt: new Date() }).where(eq(media.id, id));
  await audit(req.user, "trash", "media", id, { ipHash: req.ipHashed });
  bust("all");
  flash(res, "success", "File moved to trash.");
  res.redirect(adminUrl("/media"));
}));

mediaAdminRouter.post("/media/:id/restore", ah(async (req, res) => {
  assertCan(req, "delete", "content");
  await db.update(media).set({ deletedAt: null }).where(eq(media.id, Number(req.params.id)));
  bust("all");
  flash(res, "success", "File restored.");
  res.redirect(adminUrl(`/media/${req.params.id}`));
}));

mediaAdminRouter.post("/media/:id/destroy", ah(async (req, res) => {
  assertCan(req, "delete", "content");
  const id = Number(req.params.id);
  const m = (await db.select().from(media).where(eq(media.id, id)))[0];
  if (m) {
    await db.delete(media).where(eq(media.id, id));
    await deleteFiles(m);
    await audit(req.user, "delete", "media", id, { summary: `Deleted ${m.originalName}`, ipHash: req.ipHashed });
    bust("all");
  }
  flash(res, "success", "File permanently deleted.");
  res.redirect(adminUrl("/media?trash=1"));
}));

/** Bulk upload straight into a gallery album. */
mediaAdminRouter.post("/media/bulk", ah(async (req, res) => {
  assertCan(req, "delete", "content");
  const ids = (Array.isArray(req.body.ids) ? req.body.ids : [req.body.ids]).map(Number).filter(Boolean);
  if (ids.length && req.body.action === "trash") await db.update(media).set({ deletedAt: new Date() }).where(inArray(media.id, ids));
  bust("all");
  flash(res, "success", `${ids.length} file(s) moved to trash.`);
  res.redirect(adminUrl("/media"));
}));
