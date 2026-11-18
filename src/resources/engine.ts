import { and, asc, desc, eq, inArray, isNotNull, isNull, like, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns } from "drizzle-orm";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import { db } from "../db/index.js";
import * as s from "../db/schema/index.js";
import { audit } from "../lib/audit.js";
import { bust } from "../lib/cache.js";
import { sanitizePlain, sanitizeRich } from "../lib/sanitize.js";
import { isPlaceholder, readingMinutes, slugify } from "../lib/util.js";
import { BLOCK_MAP } from "./blocks.js";
import type { ResourceDef } from "./types.js";

type Row = Record<string, unknown>;
type Cols = Record<string, MySqlColumn>;
export type Actor = { id: number; name: string };

const cols = (t: MySqlTable): Cols => getTableColumns(t) as unknown as Cols;
const idCol = (t: MySqlTable): MySqlColumn => cols(t).id!;
export const PAGE_SIZE = 25;

// ── Listing ───────────────────────────────────────────────────────────────────────────────────────
export type ListQuery = { q?: string; page?: number; sort?: string; dir?: "asc" | "desc"; trash?: boolean; filters?: Record<string, string> };

export async function listRows(def: ResourceDef, q: ListQuery): Promise<{ rows: Row[]; total: number; page: number; pages: number; counts: { all: number; trash: number } }> {
  const c = cols(def.table);
  const where: SQL[] = [];
  if (c.deletedAt) where.push(q.trash ? isNotNull(c.deletedAt) : isNull(c.deletedAt));
  if (q.q) {
    const term = `%${q.q.replace(/[%_\\]/g, "\\$&").slice(0, 100)}%`;
    const parts = def.search.map((k) => c[k]).filter(Boolean).map((col) => like(col!, term));
    if (parts.length) where.push(or(...parts)!);
  }
  for (const f of def.filters ?? []) {
    const v = q.filters?.[f.name];
    if (v === undefined || v === "" || !c[f.name]) continue;
    if (f.kind === "bool") where.push(eq(c[f.name]!, v === "1"));
    else if (f.kind === "category") where.push(eq(c[f.name]!, Number(v)));
    else where.push(eq(c[f.name]!, v));
  }
  const cond = where.length ? and(...where) : undefined;
  const sortKey = q.sort && c[q.sort] ? q.sort : def.ordering ? "sortOrder" : c.updatedAt ? "updatedAt" : "id";
  const dir = q.dir ?? (sortKey === "sortOrder" || sortKey === def.titleField ? "asc" : "desc");
  const order = dir === "asc" ? asc(c[sortKey]!) : desc(c[sortKey]!);
  const total = Number((await db.select({ n: sql<number>`count(*)` }).from(def.table).where(cond))[0]?.n ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, q.page ?? 1), pages);
  const rows = (await db.select().from(def.table).where(cond).orderBy(order, desc(idCol(def.table))).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE)) as Row[];
  const counts = { all: 0, trash: 0 };
  if (c.deletedAt) {
    const r = await db
      .select({ all: sql<number>`sum(${c.deletedAt} is null)`, trash: sql<number>`sum(${c.deletedAt} is not null)` })
      .from(def.table);
    counts.all = Number(r[0]?.all ?? 0);
    counts.trash = Number(r[0]?.trash ?? 0);
  } else counts.all = total;
  return { rows, total, page, pages, counts };
}

/** Column names that are NOT NULL (the editor hides the empty option for these selects). */
export function notNullColumns(def: ResourceDef): Set<string> {
  return new Set(Object.entries(cols(def.table)).filter(([, c]) => c.notNull).map(([k]) => k));
}

// ── Options for selects ───────────────────────────────────────────────────────────────────────────
export type Options = Record<string, Array<[number | string, string]>>;

async function relationOptions(src: string): Promise<Array<[number, string]>> {
  switch (src) {
    case "projects":
      return (await db.select({ id: s.projects.id, t: s.projects.title }).from(s.projects).where(isNull(s.projects.deletedAt)).orderBy(asc(s.projects.title))).map((r) => [r.id, r.t]);
    case "trainings":
      return (await db.select({ id: s.trainings.id, t: s.trainings.title }).from(s.trainings).where(isNull(s.trainings.deletedAt)).orderBy(asc(s.trainings.title))).map((r) => [r.id, r.t]);
    case "skills":
      return (await db.select({ id: s.skills.id, t: s.skills.name }).from(s.skills).where(isNull(s.skills.deletedAt)).orderBy(asc(s.skills.name))).map((r) => [r.id, r.t]);
    case "certifications":
      return (await db.select({ id: s.certifications.id, t: s.certifications.name, i: s.certifications.issuer }).from(s.certifications).where(isNull(s.certifications.deletedAt))).map((r) => [r.id, `${r.t} — ${r.i}`]);
    case "courses":
      return (await db.select({ id: s.courses.id, t: s.courses.title }).from(s.courses).where(isNull(s.courses.deletedAt))).map((r) => [r.id, r.t]);
    case "services":
      return (await db.select({ id: s.services.id, t: s.services.title }).from(s.services).where(isNull(s.services.deletedAt))).map((r) => [r.id, r.t]);
    case "users":
      return (await db.select({ id: s.users.id, t: s.users.name }).from(s.users)).map((r) => [r.id, r.t]);
    case "projectCategories":
      return (await db.select({ id: s.categories.id, t: s.categories.name }).from(s.categories).where(and(eq(s.categories.type, "project"), isNull(s.categories.deletedAt))).orderBy(asc(s.categories.sortOrder))).map((r) => [r.id, r.t]);
    default:
      return [];
  }
}

export async function fieldOptions(def: ResourceDef): Promise<Options> {
  const out: Options = {};
  const catTypes = new Set<string>();
  for (const f of def.fields) if (f.type === "category") catTypes.add(f.categoryType);
  for (const f of def.filters ?? []) if (f.kind === "category") catTypes.add(f.categoryType);
  for (const col of def.columns) if (col.kind === "category") catTypes.add("*");
  const cats = catTypes.size
    ? await db.select({ id: s.categories.id, name: s.categories.name, type: s.categories.type }).from(s.categories).where(isNull(s.categories.deletedAt)).orderBy(asc(s.categories.sortOrder))
    : [];
  for (const t of catTypes) out[`cat:${t}`] = cats.filter((c) => t === "*" || c.type === t).map((c) => [c.id, c.name]);
  for (const f of def.fields) {
    if (f.type === "relation" || f.type === "ids" || f.type === "join") out[f.name] = await relationOptions(f.resource);
  }
  return out;
}

// ── Loading one record with its child collections ─────────────────────────────────────────────────
export async function loadRecord(def: ResourceDef, id: number): Promise<Row | null> {
  const row = (await db.select().from(def.table).where(eq(idCol(def.table), id)).limit(1))[0] as Row | undefined;
  if (!row) return null;
  const out: Row = { ...row };
  for (const f of def.fields) {
    if (f.type === "children" || f.type === "gallery") {
      const c = cols(f.table);
      out[f.name] = await db.select().from(f.table).where(eq(c[f.fk]!, id)).orderBy(asc(c.sortOrder!));
    } else if (f.type === "join") {
      const c = cols(f.table);
      out[f.name] = (await db.select().from(f.table).where(eq(c[f.fk]!, id)).orderBy(asc(c.sortOrder!))).map((r) => (r as Row)[f.otherFk]);
    } else if (f.type === "tags") {
      out[f.name] = (
        await db
          .select({ name: s.tags.name })
          .from(s.taggables)
          .innerJoin(s.tags, eq(s.tags.id, s.taggables.tagId))
          .where(and(eq(s.taggables.taggableType, def.key), eq(s.taggables.taggableId, id)))
      )
        .map((t) => t.name)
        .join(", ");
    } else if (f.type === "blocks") {
      out[f.name] = (await db.select().from(s.pageBlocks).where(eq(s.pageBlocks.pageId, id)).orderBy(asc(s.pageBlocks.sortOrder))).map((b) => ({ type: b.type, data: b.data }));
    } else if (f.type === "albumImages") {
      out[f.name] = (
        await db
          .select({ mediaId: s.media.id, caption: s.media.caption, alt: s.media.alt, credit: s.media.credit })
          .from(s.media)
          .where(and(eq(s.media.albumId, id), isNull(s.media.deletedAt)))
          .orderBy(asc(s.media.albumOrder), asc(s.media.id))
      ).map((m) => ({ ...m, caption: m.caption ?? "", alt: m.alt ?? "", credit: m.credit ?? "" }));
    }
  }
  return out;
}

/** Collect all media ids referenced by a (form-shaped) record, for previews and usage tracking. */
export function mediaIdsOf(def: ResourceDef, rec: Row): number[] {
  const ids: number[] = [];
  const push = (v: unknown) => {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  };
  for (const f of def.fields) {
    const v = rec[f.name];
    if (f.type === "image" || f.type === "file") push(v);
    if ((f.type === "gallery" || f.type === "albumImages") && Array.isArray(v)) v.forEach((g) => push((g as Row).mediaId));
    if (f.type === "blocks" && Array.isArray(v)) v.forEach((b) => push(((b as Row).data as Row | undefined)?.imageId));
  }
  if (def.seo) push(rec.ogImageId);
  return [...new Set(ids)];
}

// ── Validation ────────────────────────────────────────────────────────────────────────────────────
export type SaveResult = { ok: true; id: number; created: boolean } | { ok: false; errors: Record<string, string>; values: Row };

const MAX_JSON = 2_000_000;
function parseJson<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string" || v === "" || v.length > MAX_JSON) return Array.isArray(v) ? (v as T) : fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
const str = (v: unknown): string => (Array.isArray(v) ? String(v.at(-1) ?? "") : typeof v === "string" || typeof v === "number" ? String(v) : "").trim();
const bool = (v: unknown): boolean => (Array.isArray(v) ? v.some((x) => x === "1" || x === "on" || x === "true") : v === "1" || v === "on" || v === "true" || v === true);
const intOrNull = (v: unknown): number | null => {
  const t = str(v);
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};
const ids = (v: unknown): number[] =>
  (Array.isArray(v) ? v : v === undefined || v === "" ? [] : [v]).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);

const URL_RE = /^(https?:\/\/[^\s]+|mailto:[^\s]+|tel:[+\d\s-]+|\/[^\s]*)$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Converts a submitted form body into DB-ready values plus collections, collecting field errors. */
export function validate(def: ResourceDef, body: Row): { main: Row; extra: Row; values: Row; errors: Record<string, string> } {
  const main: Row = {};
  const extra: Row = {};
  const values: Row = {};
  const errors: Record<string, string> = {};
  const c = cols(def.table);

  for (const f of def.fields) {
    if (f.readonly) continue;
    const raw = body[f.name];
    const req = (ok: boolean) => {
      if (f.required && !ok) errors[f.name] = `${f.label} is required.`;
    };
    switch (f.type) {
      case "text":
      case "email":
      case "url":
      case "color":
      case "textarea": {
        const v = sanitizePlain(str(raw));
        values[f.name] = v;
        req(v !== "");
        const max = "max" in f && f.max ? f.max : f.type === "textarea" ? 20000 : 500;
        if (v.length > max) errors[f.name] = `${f.label} is too long (max ${max} characters).`;
        if (v && f.type === "url" && !isPlaceholder(v) && !URL_RE.test(v)) errors[f.name] = "Enter a full URL starting with https:// (or a site path like /contact).";
        if (v && f.type === "email" && !EMAIL_RE.test(v)) errors[f.name] = "Enter a valid email address.";
        if (v && f.type === "color" && !/^#[0-9a-f]{6}$/i.test(v)) errors[f.name] = "Use a hex color like #B8925A.";
        main[f.name] = v === "" ? (f.required ? "" : null) : v;
        break;
      }
      case "number": {
        const t = str(raw);
        values[f.name] = t;
        if (t === "") {
          req(false);
          main[f.name] = null;
          break;
        }
        const n = Number(t);
        if (!Number.isFinite(n)) errors[f.name] = `${f.label} must be a number.`;
        else if (f.min !== undefined && n < f.min) errors[f.name] = `${f.label} must be at least ${f.min}.`;
        else if (f.max !== undefined && n > f.max) errors[f.name] = `${f.label} must be at most ${f.max}.`;
        main[f.name] = f.step && f.step < 1 ? n.toFixed(2) : Math.trunc(n);
        break;
      }
      case "date": {
        const t = str(raw);
        values[f.name] = t;
        if (t && !/^\d{4}-\d{2}-\d{2}$/.test(t)) errors[f.name] = "Use the format YYYY-MM-DD.";
        req(t !== "");
        main[f.name] = t || null;
        break;
      }
      case "datetime": {
        const t = str(raw);
        values[f.name] = t;
        const d = t ? new Date(`${t}${t.length === 16 ? ":00Z" : ""}`) : null;
        if (t && (!d || Number.isNaN(d.getTime()))) errors[f.name] = "Enter a valid date and time.";
        main[f.name] = d;
        break;
      }
      case "slug": {
        const srcVal = str(body[f.source]);
        let v = str(raw) || srcVal;
        v = f.allowSlash
          ? v.split("/").map((p) => slugify(p, 80)).filter(Boolean).join("/")
          : slugify(v, 120);
        values[f.name] = v;
        if (!v) errors[f.name] = "Slug is required.";
        if (f.allowSlash && /^(admin|api|media|assets|fonts|setup|work|training|insights|services|certifications|gallery|testimonials|review|status|contact|resume|courses|about|newsletter|og|rss\.xml|sitemap\.xml|robots\.txt)(\/|$)/.test(v))
          errors[f.name] = "That path is reserved by the site. Choose another.";
        main[f.name] = v;
        break;
      }
      case "boolean":
        main[f.name] = bool(raw);
        values[f.name] = main[f.name];
        break;
      case "select": {
        const v = str(raw);
        values[f.name] = v;
        const allowed = f.options.map((o) => o[0]);
        if (v && !allowed.includes(v)) errors[f.name] = `Choose a valid ${f.label.toLowerCase()}.`;
        req(v !== "");
        main[f.name] = v === "" ? null : f.name === "rating" ? Number(v) : v;
        if (main[f.name] === null && def.defaults?.[f.name] !== undefined) main[f.name] = def.defaults[f.name];
        // NOT NULL enum columns never receive NULL: fall back to the first option.
        if (main[f.name] === null && c[f.name]?.notNull) main[f.name] = f.name === "rating" ? Number(f.options[0]![0]) : f.options[0]![0];
        break;
      }
      case "category":
      case "relation":
      case "image":
      case "file": {
        const v = intOrNull(raw);
        values[f.name] = v;
        req(v !== null);
        main[f.name] = v;
        break;
      }
      case "icon": {
        const v = str(raw).slice(0, 60);
        values[f.name] = v;
        main[f.name] = v || null;
        break;
      }
      case "richtext": {
        const html = sanitizeRich(str(body[`${f.name}Html`]));
        const json = parseJson<unknown>(body[`${f.name}Json`], null);
        values[`${f.name}Html`] = html;
        values[`${f.name}Json`] = json;
        if (c[`${f.name}Html`]) main[`${f.name}Html`] = html || null;
        if (c[`${f.name}Json`]) main[`${f.name}Json`] = json;
        req(html.replace(/<[^>]+>/g, "").trim() !== "");
        break;
      }
      case "list": {
        const list = parseJson<unknown[]>(raw, []).map((x) => sanitizePlain(String(x ?? ""))).filter(Boolean).slice(0, 60);
        values[f.name] = list;
        main[f.name] = list;
        break;
      }
      case "steps": {
        const list = parseJson<Row[]>(raw, [])
          .map((x) => ({ title: sanitizePlain(String(x?.title ?? "")), description: sanitizePlain(String(x?.description ?? "")) }))
          .filter((x) => x.title)
          .slice(0, 20);
        values[f.name] = list;
        main[f.name] = list;
        break;
      }
      case "ids": {
        const list = ids(raw);
        values[f.name] = list;
        main[f.name] = list;
        break;
      }
      case "join": {
        const list = ids(raw);
        values[f.name] = list;
        extra[f.name] = list;
        break;
      }
      case "children": {
        const list = parseJson<Row[]>(raw, [])
          .slice(0, 100)
          .map((x) => Object.fromEntries(f.subfields.map((sf) => [sf.name, sanitizePlain(String(x?.[sf.name] ?? "")).slice(0, sf.type === "textarea" ? 5000 : 255)])))
          .filter((x) => f.subfields.some((sf) => x[sf.name]));
        values[f.name] = list;
        list.forEach((x, i) => {
          for (const sf of f.subfields) if (sf.required && !x[sf.name]) errors[f.name] = `${f.label}: item ${i + 1} needs a ${sf.label.toLowerCase()}.`;
        });
        extra[f.name] = list;
        break;
      }
      case "gallery":
      case "albumImages": {
        const list = parseJson<Row[]>(raw, [])
          .slice(0, 500)
          .map((x) => ({
            mediaId: Number(x?.mediaId),
            caption: sanitizePlain(String(x?.caption ?? "")).slice(0, 255),
            alt: sanitizePlain(String(x?.alt ?? "")).slice(0, 255),
            credit: sanitizePlain(String(x?.credit ?? "")).slice(0, 191),
          }))
          .filter((x) => Number.isInteger(x.mediaId) && x.mediaId > 0);
        values[f.name] = list;
        if (f.type === "albumImages") {
          const missing = list.findIndex((x) => !x.alt);
          if (missing >= 0) errors[f.name] = `Photo ${missing + 1} needs alt text (describe the image for screen readers).`;
        }
        extra[f.name] = list;
        break;
      }
      case "tags": {
        const v = str(raw);
        values[f.name] = v;
        extra[f.name] = [...new Set(v.split(",").map((t) => sanitizePlain(t).slice(0, 80)).filter(Boolean))].slice(0, 20);
        break;
      }
      case "blocks": {
        const list = parseJson<Row[]>(raw, [])
          .slice(0, 80)
          .filter((b) => typeof b?.type === "string" && BLOCK_MAP[b.type as string])
          .map((b) => {
            const def2 = BLOCK_MAP[b.type as string]!;
            const data: Row = {};
            const src = (b.data ?? {}) as Row;
            for (const bf of def2.fields) {
              const v = src[bf.name];
              if (bf.type === "richtext") data[bf.name] = sanitizeRich(String(v ?? ""));
              else if (bf.type === "number" || bf.type === "image") data[bf.name] = intOrNull(v);
              else if (bf.type === "boolean") data[bf.name] = bool(v);
              else if (bf.type === "select") data[bf.name] = bf.options?.some((o) => o[0] === v) ? v : (def2.defaults[bf.name] ?? bf.options?.[0]?.[0]);
              else data[bf.name] = sanitizePlain(String(v ?? "")).slice(0, 2000);
              if (bf.type === "url" && data[bf.name] && !URL_RE.test(String(data[bf.name]))) data[bf.name] = "";
            }
            return { type: b.type as string, data };
          });
        values[f.name] = list;
        extra[f.name] = list;
        break;
      }
    }
  }

  // Publication & feature fields
  if (def.status) {
    const st = str(body.status) || "draft";
    values.status = st;
    if (!["draft", "published", "scheduled"].includes(st)) errors.status = "Choose a valid status.";
    main.status = st;
    const t = str(body.publishedAt);
    values.publishedAt = t;
    const d = t ? new Date(`${t}${t.length === 16 ? ":00Z" : ""}`) : null;
    if (t && (!d || Number.isNaN(d.getTime()))) errors.publishedAt = "Enter a valid date and time.";
    if (st === "scheduled" && !d) errors.publishedAt = "Choose when this should be published.";
    main.publishedAt = d ?? (st === "published" ? new Date() : null);
  }
  if (def.featured) main.featured = values.featured = bool(body.featured);
  if (def.sample) main.isSample = values.isSample = bool(body.isSample);
  if (def.seo) {
    main.seoTitle = values.seoTitle = sanitizePlain(str(body.seoTitle)).slice(0, 191) || null;
    main.seoDescription = values.seoDescription = sanitizePlain(str(body.seoDescription)).slice(0, 320) || null;
    main.ogImageId = values.ogImageId = intOrNull(body.ogImageId);
  }

  // Guard rails: placeholders and samples never go public (brief §0.4, §11).
  const goingPublic = (def.status && main.status !== "draft") || (def.key === "testimonials" && main.moderation === "approved");
  if (goingPublic) {
    const ph = def.fields.find((f) => (f.required || f.name === def.titleField) && isPlaceholder(main[f.name]));
    if (ph) errors[ph.name] = `Replace the placeholder in “${ph.label}” before publishing.`;
    if (main.isSample) errors.isSample = "Untick “Sample” once you've replaced this with real, verified content — samples can't be published.";
  }
  if (def.key === "posts" && typeof main.bodyHtml === "string") main.readingMinutes = readingMinutes(main.bodyHtml);
  return { main, extra, values, errors };
}

async function uniqueSlug(def: ResourceDef, slug: string, id: number | null, scope?: SQL): Promise<string> {
  const c = cols(def.table);
  if (!c.slug) return slug;
  let candidate = slug;
  for (let i = 2; i < 200; i++) {
    const clash = await db
      .select({ id: idCol(def.table) })
      .from(def.table)
      .where(and(eq(c.slug, candidate), scope ?? sql`1=1`, id ? sql`${idCol(def.table)} <> ${id}` : sql`1=1`))
      .limit(1);
    if (!clash.length) return candidate;
    candidate = `${slug}-${i}`;
  }
  return `${slug}-${Date.now()}`;
}

// ── Persistence ───────────────────────────────────────────────────────────────────────────────────
async function writeCollections(def: ResourceDef, id: number, extra: Row, tx: typeof db): Promise<void> {
  for (const f of def.fields) {
    if (!(f.name in extra)) continue;
    const list = extra[f.name] as Row[] | number[] | string[];
    if (f.type === "children" || f.type === "gallery") {
      const c = cols(f.table);
      await tx.delete(f.table).where(eq(c[f.fk]!, id));
      const rows = (list as Row[]).map((x, i) =>
        f.type === "gallery" ? { [f.fk]: id, mediaId: x.mediaId, caption: x.caption || null, sortOrder: i } : { ...x, [f.fk]: id, sortOrder: i },
      );
      if (rows.length) await tx.insert(f.table).values(rows as never);
    } else if (f.type === "join") {
      const c = cols(f.table);
      await tx.delete(f.table).where(eq(c[f.fk]!, id));
      if (list.length) await tx.insert(f.table).values((list as number[]).map((o, i) => ({ [f.fk]: id, [f.otherFk]: o, sortOrder: i })) as never);
    } else if (f.type === "tags") {
      await tx.delete(s.taggables).where(and(eq(s.taggables.taggableType, def.key), eq(s.taggables.taggableId, id)));
      for (const name of list as string[]) {
        const slug = slugify(name, 100);
        if (!slug) continue;
        await tx.insert(s.tags).ignore().values({ name, slug });
        const tag = (await tx.select({ id: s.tags.id }).from(s.tags).where(eq(s.tags.slug, slug)))[0]!;
        await tx.insert(s.taggables).ignore().values({ tagId: tag.id, taggableType: def.key, taggableId: id });
      }
    } else if (f.type === "blocks") {
      await tx.delete(s.pageBlocks).where(eq(s.pageBlocks.pageId, id));
      const rows = (list as Row[]).map((b, i) => ({ pageId: id, type: b.type as string, data: b.data as Record<string, unknown>, sortOrder: i }));
      if (rows.length) await tx.insert(s.pageBlocks).values(rows);
    } else if (f.type === "albumImages") {
      const keep = (list as Row[]).map((x) => Number(x.mediaId));
      await tx
        .update(s.media)
        .set({ albumId: null })
        .where(and(eq(s.media.albumId, id), keep.length ? sql`${s.media.id} NOT IN (${sql.join(keep.map((k) => sql`${k}`), sql`, `)})` : sql`1=1`));
      for (const [i, x] of (list as Row[]).entries()) {
        await tx
          .update(s.media)
          .set({ albumId: id, albumOrder: i, caption: (x.caption as string) || null, alt: (x.alt as string) || null, credit: (x.credit as string) || null })
          .where(eq(s.media.id, Number(x.mediaId)));
      }
    }
  }
}

async function writeUsages(def: ResourceDef, id: number, rec: Row): Promise<void> {
  await db.delete(s.mediaUsages).where(and(eq(s.mediaUsages.resource, def.key), eq(s.mediaUsages.resourceId, id)));
  const usage: Array<{ mediaId: number; field: string }> = [];
  for (const f of def.fields) {
    const v = rec[f.name];
    if ((f.type === "image" || f.type === "file") && v) usage.push({ mediaId: Number(v), field: f.name });
    if ((f.type === "gallery" || f.type === "albumImages") && Array.isArray(v)) v.forEach((g) => usage.push({ mediaId: Number((g as Row).mediaId), field: f.name }));
    if (f.type === "blocks" && Array.isArray(v)) v.forEach((b) => (b as Row).data && ((b as Row).data as Row).imageId && usage.push({ mediaId: Number(((b as Row).data as Row).imageId), field: "blocks" }));
  }
  if (def.seo && rec.ogImageId) usage.push({ mediaId: Number(rec.ogImageId), field: "ogImageId" });
  const existing = usage.length ? new Set((await db.select({ id: s.media.id }).from(s.media).where(inArray(s.media.id, usage.map((u) => u.mediaId)))).map((r) => r.id)) : new Set<number>();
  const rows = usage.filter((u) => existing.has(u.mediaId)).map((u) => ({ ...u, resource: def.key, resourceId: id }));
  if (rows.length) await db.insert(s.mediaUsages).values(rows);
}

export async function saveRecord(def: ResourceDef, id: number | null, body: Row, actor: Actor, ipHash?: string): Promise<SaveResult> {
  const { main, extra, values, errors } = validate(def, body);
  if (Object.keys(errors).length) return { ok: false, errors, values };
  const before = id ? await loadRecord(def, id) : null;
  if (id && !before) return { ok: false, errors: { _form: "This item no longer exists." }, values };
  if (typeof main.slug === "string") {
    main.slug = await uniqueSlug(def, main.slug, id, def.key === "categories" ? eq(cols(def.table).type!, String(main.type)) : undefined);
  }
  if (def.key === "cvs" && main.isPrimary) await db.update(s.cvFiles).set({ isPrimary: false });
  let newId = id ?? 0;
  await db.transaction(async (tx) => {
    if (id) {
      await tx.update(def.table).set(main as never).where(eq(idCol(def.table), id));
    } else {
      if (def.ordering) {
        const max = await tx.select({ m: sql<number>`coalesce(max(sort_order), -1)` }).from(def.table);
        main.sortOrder = Number(max[0]?.m ?? -1) + 1;
      }
      if (def.key === "posts" && !main.authorId) main.authorId = actor.id;
      const [r] = await tx.insert(def.table).values({ ...(def.defaults ?? {}), ...main } as never);
      newId = (r as unknown as { insertId: number }).insertId;
    }
    await writeCollections(def, newId, extra, tx as unknown as typeof db);
  });
  const after = await loadRecord(def, newId);
  await writeUsages(def, newId, after ?? {});
  await audit(actor, id ? "update" : "create", def.key, newId, {
    summary: `${id ? "Updated" : "Created"} ${def.singular.toLowerCase()} “${String(after?.[def.titleField] ?? newId).slice(0, 120)}”`,
    before: before ? flatten(before) : null,
    after: after ? flatten(after) : null,
    ipHash,
  });
  bust(...def.tags, def.key);
  return { ok: true, id: newId, created: !id };
}

/** For audit diffs: collections are summarised as JSON so changes are visible. */
function flatten(r: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) out[k] = Array.isArray(v) ? JSON.stringify(v).slice(0, 400) : v;
  return out;
}

export async function duplicateRecord(def: ResourceDef, id: number, actor: Actor, ipHash?: string): Promise<number | null> {
  const rec = await loadRecord(def, id);
  if (!rec) return null;
  const body: Row = {};
  for (const f of def.fields) {
    const v = rec[f.name];
    if (f.type === "richtext") {
      body[`${f.name}Html`] = rec[`${f.name}Html`] ?? "";
      body[`${f.name}Json`] = rec[`${f.name}Json`] ? JSON.stringify(rec[`${f.name}Json`]) : "";
    } else if (["list", "steps", "children", "gallery", "blocks"].includes(f.type)) body[f.name] = JSON.stringify(v ?? []);
    else if (f.type === "albumImages") body[f.name] = "[]";
    else if (f.type === "boolean") body[f.name] = v ? "1" : "0";
    else if (f.type === "date") body[f.name] = v ?? "";
    else body[f.name] = v ?? "";
  }
  body[def.titleField] = `${String(rec[def.titleField] ?? "")} (copy)`.slice(0, 191);
  if ("slug" in rec) body.slug = `${String(rec.slug)}-copy`;
  body.status = "draft";
  body.featured = rec.featured ? "1" : "0";
  body.isSample = rec.isSample ? "1" : "0";
  if (def.key === "testimonials") body.moderation = "pending";
  if (def.key === "cvs") body.isPrimary = "0";
  const r = await saveRecord(def, null, body, actor, ipHash);
  return r.ok ? r.id : null;
}

export async function trashRecords(def: ResourceDef, idList: number[], actor: Actor, ipHash?: string): Promise<void> {
  if (!idList.length) return;
  await db.update(def.table).set({ deletedAt: new Date() } as never).where(inArray(idCol(def.table), idList));
  await audit(actor, "trash", def.key, idList.join(","), { summary: `Moved ${idList.length} ${def.label.toLowerCase()} to trash`, ipHash });
  bust(...def.tags, def.key);
}

export async function restoreRecords(def: ResourceDef, idList: number[], actor: Actor, ipHash?: string): Promise<void> {
  if (!idList.length) return;
  await db.update(def.table).set({ deletedAt: null } as never).where(inArray(idCol(def.table), idList));
  await audit(actor, "restore", def.key, idList.join(","), { summary: `Restored ${idList.length} ${def.label.toLowerCase()}`, ipHash });
  bust(...def.tags, def.key);
}

export async function destroyRecords(def: ResourceDef, idList: number[], actor: Actor, ipHash?: string): Promise<void> {
  if (!idList.length) return;
  const titles = (await db.select().from(def.table).where(inArray(idCol(def.table), idList))).map((r) => (r as Row)[def.titleField]);
  if (def.fields.some((f) => f.type === "albumImages")) await db.update(s.media).set({ albumId: null }).where(inArray(s.media.albumId, idList));
  if (def.fields.some((f) => f.type === "tags")) await db.delete(s.taggables).where(and(eq(s.taggables.taggableType, def.key), inArray(s.taggables.taggableId, idList)));
  await db.delete(s.mediaUsages).where(and(eq(s.mediaUsages.resource, def.key), inArray(s.mediaUsages.resourceId, idList)));
  await db.delete(def.table).where(inArray(idCol(def.table), idList));
  await audit(actor, "delete", def.key, idList.join(","), { summary: `Permanently deleted: ${titles.join(", ").slice(0, 200)}`, ipHash });
  bust(...def.tags, def.key);
}

export async function reorderRecords(def: ResourceDef, orderedIds: number[], actor: Actor): Promise<void> {
  if (!def.ordering || !orderedIds.length) return;
  await db.transaction(async (tx) => {
    for (const [i, id] of orderedIds.entries()) await tx.update(def.table).set({ sortOrder: i } as never).where(eq(idCol(def.table), id));
  });
  await audit(actor, "reorder", def.key, null, { summary: `Reordered ${def.label.toLowerCase()}` });
  bust(...def.tags, def.key);
}

export async function setField(def: ResourceDef, idList: number[], patch: Row, actor: Actor, ipHash?: string): Promise<void> {
  if (!idList.length) return;
  if (patch.status === "published") {
    const c = cols(def.table);
    if (c.isSample) {
      const samples = await db.select({ id: idCol(def.table) }).from(def.table).where(and(inArray(idCol(def.table), idList), eq(c.isSample, true)));
      idList = idList.filter((i) => !samples.some((x) => x.id === i));
    }
    if (c.publishedAt) await db.update(def.table).set({ publishedAt: new Date() } as never).where(and(inArray(idCol(def.table), idList), isNull(c.publishedAt)));
  }
  if (!idList.length) return;
  await db.update(def.table).set(patch as never).where(inArray(idCol(def.table), idList));
  await audit(actor, "bulk_update", def.key, idList.join(","), { summary: `Set ${Object.entries(patch).map(([k, v]) => `${k}=${String(v)}`).join(", ")} on ${idList.length} item(s)`, ipHash });
  bust(...def.tags, def.key);
}

export async function recordAudit(def: ResourceDef, id: number) {
  return db
    .select()
    .from(s.auditLogs)
    .where(and(eq(s.auditLogs.resource, def.key), or(eq(s.auditLogs.resourceId, String(id)), like(s.auditLogs.resourceId, `%,${id},%`), like(s.auditLogs.resourceId, `${id},%`), like(s.auditLogs.resourceId, `%,${id}`))))
    .orderBy(desc(s.auditLogs.createdAt))
    .limit(15);
}

