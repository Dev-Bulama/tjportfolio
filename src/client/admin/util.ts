export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
export const csrf = (): string => document.body.dataset.csrf ?? "";
export const adminBase = (): string => document.body.dataset.adminBase ?? "/admin";

export async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { Accept: "application/json", "x-csrf-token": csrf(), "x-requested-with": "fetch", ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({ ok: false, error: `Request failed (${res.status})` }))) as T;
  return data;
}

export function toast(msg: string, type: "success" | "error" | "info" = "info"): void {
  const root = $("[data-toasts]");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast pointer-events-auto rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-xl";
  el.dataset.toast = "";
  const dot = document.createElement("span");
  dot.className = `mr-2 inline-block size-2 rounded-full ${type === "error" ? "bg-danger" : type === "success" ? "bg-teal" : "bg-gold"}`;
  el.append(dot, document.createTextNode(msg));
  root.append(el);
  setTimeout(() => el.remove(), 5000);
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...children: Array<Node | string | null | undefined>): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") el.className = String(v);
    else if (k === "text") el.textContent = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(typeof c === "string" ? document.createTextNode(c) : c);
  return el;
}

export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Marks the closest editor form as dirty (for unsaved-changes guard + autosave). */
export function markDirty(el: Element): void {
  const form = el.closest("form[data-editor]") as HTMLFormElement | null;
  if (form) form.dataset.dirty = "1";
}
