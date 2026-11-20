import { Router, type Request, type Response } from "express";
import { adminUrl } from "../../config/env.js";
import { getResource } from "../../resources/registry.js";
import * as E from "../../resources/engine.js";
import { BLOCKS } from "../../resources/blocks.js";
import { ICON_CHOICES } from "../../lib/icons.js";
import { mediaMap } from "../../server/media.js";
import { ah, allowed, assertCan, flash, wantsJson } from "./mw.js";
import type { ResourceDef } from "../../resources/types.js";

export const contentRouter = Router();

function resource(req: Request): ResourceDef {
  const def = getResource(String(req.params.resource));
  if (!def) {
    const e = new Error("Unknown content type") as Error & { status: number };
    e.status = 404;
    throw e;
  }
  return def;
}
const actor = (req: Request) => ({ id: req.user!.id, name: req.user!.name });
const idsFrom = (v: unknown): number[] => (Array.isArray(v) ? v : v ? [v] : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);

// ── List ──────────────────────────────────────────────────────────────────────────────────────────
contentRouter.get("/content/:resource", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const def = resource(req);
  const filters: Record<string, string> = {};
  for (const f of def.filters ?? []) if (typeof req.query[f.name] === "string") filters[f.name] = req.query[f.name] as string;
  if (req.query.sample === "1" && def.sample) filters.isSample = "1";
  const query: E.ListQuery = {
    q: typeof req.query.q === "string" ? req.query.q : undefined,
    page: Number(req.query.page) || 1,
    sort: typeof req.query.sort === "string" ? req.query.sort : undefined,
    dir: req.query.dir === "asc" ? "asc" : req.query.dir === "desc" ? "desc" : undefined,
    trash: req.query.trash === "1",
    filters,
  };
  const [result, options] = await Promise.all([E.listRows(def, query), E.fieldOptions(def)]);
  const imgCols = def.columns.filter((c) => c.kind === "image").map((c) => c.key);
  const media = await mediaMap(result.rows.flatMap((r) => imgCols.map((k) => r[k] as number | null)));
  const canReorder = Boolean(def.ordering) && !query.q && !Object.keys(filters).length && !query.trash && (!query.sort || query.sort === "sortOrder") && result.pages === 1;
  await res.page("admin/content/list", {
    layout: "admin",
    title: def.label,
    def,
    result,
    query: { ...query, filters, sample: req.query.sample },
    options,
    media,
    canReorder,
    baseParams: { q: query.q, sort: req.query.sort, dir: req.query.dir, trash: query.trash ? "1" : undefined, ...filters },
  });
}));

// ── Editor ────────────────────────────────────────────────────────────────────────────────────────
async function renderEditor(req: Request, res: Response, def: ResourceDef, id: number | null, values: Record<string, unknown>, errors: Record<string, string> = {}, status = 200) {
  const options = await E.fieldOptions(def);
  const notNull = E.notNullColumns(def);
  def = { ...def, fields: def.fields.map((f) => (f.type === "select" && notNull.has(f.name) ? { ...f, notNull: true } : f)) };
  const media = await mediaMap(E.mediaIdsOf(def, values));
  const history = id ? await E.recordAudit(def, id) : [];
  const readOnly = !allowed(req, id ? "update" : "create", "content");
  await res.page(
    "admin/content/edit",
    {
      layout: "admin",
      title: id ? `Edit ${def.singular.toLowerCase()}` : `New ${def.singular.toLowerCase()}`,
      def,
      id,
      values,
      errors,
      options,
      media,
      history,
      readOnly,
      icons: ICON_CHOICES,
      blocks: BLOCKS,
      publicUrl: id && def.publicUrl ? def.publicUrl(values) : null,
    },
    status,
  );
}

contentRouter.get("/content/:resource/new", ah(async (req, res) => {
  assertCan(req, "create", "content");
  const def = resource(req);
  if (def.canCreate === false) return res.redirect(adminUrl(`/content/${def.key}`));
  await renderEditor(req, res, def, null, { status: "draft", ...(def.defaults ?? {}), ...(def.fields.some((f) => f.name === "showClient") ? { showClient: true } : {}) });
}));

contentRouter.get("/content/:resource/:id", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const def = resource(req);
  const rec = await E.loadRecord(def, Number(req.params.id));
  if (!rec) {
    flash(res, "error", `That ${def.singular.toLowerCase()} doesn't exist.`);
    return res.redirect(adminUrl(`/content/${def.key}`));
  }
  if (rec.publishedAt instanceof Date) rec.publishedAt = rec.publishedAt.toISOString().slice(0, 16);
  await renderEditor(req, res, def, Number(req.params.id), rec);
}));

async function handleSave(req: Request, res: Response, id: number | null) {
  const def = resource(req);
  assertCan(req, id ? "update" : "create", "content");
  if (!id && def.canCreate === false) return res.redirect(adminUrl(`/content/${def.key}`));
  const body = req.body as Record<string, unknown>;
  // Editors without publish rights can only save drafts.
  if (def.status && body.status && body.status !== "draft") assertCan(req, "publish", "content");
  const autosave = req.get("x-autosave") === "1";
  const result = await E.saveRecord(def, id, body, actor(req), req.ipHashed);
  if (wantsJson(req) || autosave) {
    if (!result.ok) return res.status(422).json({ ok: false, errors: result.errors });
    return res.json({ ok: true, id: result.id, created: result.created, editUrl: adminUrl(`/content/${def.key}/${result.id}`), savedAt: new Date().toISOString() });
  }
  if (!result.ok) {
    res.locals.flash = { type: "error", msg: `Please fix ${Object.keys(result.errors).length} field(s) and save again.` };
    return renderEditor(req, res, def, id, { ...result.values, id }, result.errors, 422);
  }
  flash(res, "success", `${def.singular} ${result.created ? "created" : "saved"}.`);
  res.redirect(adminUrl(`/content/${def.key}/${result.id}`));
}

contentRouter.post("/content/:resource/new", ah((req, res) => handleSave(req, res, null)));


// ── Row actions ───────────────────────────────────────────────────────────────────────────────────
contentRouter.post("/content/:resource/:id/duplicate", ah(async (req, res) => {
  assertCan(req, "create", "content");
  const def = resource(req);
  const newId = await E.duplicateRecord(def, Number(req.params.id), actor(req), req.ipHashed);
  flash(res, newId ? "success" : "error", newId ? `${def.singular} duplicated as a draft.` : "Couldn't duplicate that item.");
  res.redirect(adminUrl(newId ? `/content/${def.key}/${newId}` : `/content/${def.key}`));
}));

contentRouter.post("/content/:resource/:id/trash", ah(async (req, res) => {
  assertCan(req, "delete", "content");
  const def = resource(req);
  if (def.canDelete === false || !def.trash) throw Object.assign(new Error("This item can't be deleted."), { status: 400 });
  await E.trashRecords(def, [Number(req.params.id)], actor(req), req.ipHashed);
  flash(res, "success", `Moved to trash. You can restore it for 30 days.`);
  res.redirect(adminUrl(`/content/${def.key}`));
}));

contentRouter.get("/content/:resource/:id/preview", ah(async (req, res) => {
  assertCan(req, "view", "content");
  const def = resource(req);
  const rec = await E.loadRecord(def, Number(req.params.id));
  const url = rec && def.publicUrl?.(rec);
  if (!url) return res.redirect(adminUrl(`/content/${def.key}/${req.params.id}`));
  res.redirect(`${url}${url.includes("?") ? "&" : "?"}preview=1`);
}));

contentRouter.post("/content/:resource/reorder", ah(async (req, res) => {
  assertCan(req, "update", "content");
  const def = resource(req);
  await E.reorderRecords(def, idsFrom(req.body.ids), actor(req));
  res.json({ ok: true });
}));

contentRouter.post("/content/:resource/bulk", ah(async (req, res) => {
  const def = resource(req);
  const ids = idsFrom(req.body.ids);
  const action = String(req.body.action ?? "");
  const back = adminUrl(`/content/${def.key}${req.body.trash === "1" ? "?trash=1" : ""}`);
  if (!ids.length) {
    flash(res, "error", "Select at least one item first.");
    return res.redirect(back);
  }
  switch (action) {
    case "publish":
    case "unpublish":
      assertCan(req, "publish", "content");
      if (def.key === "testimonials") await E.setField(def, ids, { moderation: action === "publish" ? "approved" : "pending" }, actor(req), req.ipHashed);
      else await E.setField(def, ids, { status: action === "publish" ? "published" : "draft" }, actor(req), req.ipHashed);
      break;
    case "feature":
    case "unfeature":
      assertCan(req, "update", "content");
      await E.setField(def, ids, { featured: action === "feature" }, actor(req), req.ipHashed);
      break;
    case "trash":
      assertCan(req, "delete", "content");
      await E.trashRecords(def, ids, actor(req), req.ipHashed);
      break;
    case "restore":
      assertCan(req, "delete", "content");
      await E.restoreRecords(def, ids, actor(req), req.ipHashed);
      break;
    case "destroy":
      assertCan(req, "delete", "content");
      if (def.canDelete === false) throw Object.assign(new Error("These items can't be deleted."), { status: 400 });
      await E.destroyRecords(def, ids, actor(req), req.ipHashed);
      break;
    default:
      flash(res, "error", "Unknown action.");
      return res.redirect(back);
  }
  flash(res, "success", `${ids.length} item${ids.length > 1 ? "s" : ""} updated.`);
  res.redirect(back);
}));

// Must stay last: generic update route.
contentRouter.post("/content/:resource/:id", ah(async (req, res, next) => {
  if (!/^\d+$/.test(String(req.params.id))) return next();
  await handleSave(req, res, Number(req.params.id));
}));
