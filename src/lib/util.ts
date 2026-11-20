/** Pure helpers shared by server code, views and tests (no Node-only imports). */

const PLACEHOLDER = /\[\[[^\]]*\]\]/;

/** True when a seeded value still contains an editable placeholder like `[[add LinkedIn URL]]`. */
export function isPlaceholder(v: unknown): boolean {
  return typeof v === "string" && PLACEHOLDER.test(v);
}

/** Public-safe value: returns undefined for empty or placeholder values so templates can hide them. */
export function pub<T>(v: T | null | undefined): T | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "string" && (v.trim() === "" || isPlaceholder(v))) return undefined;
  return v;
}

export function slugify(input: string, max = 120): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "");
}

export function stripHtml(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function readingMinutes(html: string | null | undefined, wpm = 220): number {
  const words = stripHtml(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / wpm));
}

export function truncate(s: string | null | undefined, n: number): string {
  const t = (s ?? "").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, "")}…`;
}

export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toDate(d: Date | string | null | undefined): Date | null {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d.length === 10 ? `${d}T00:00:00Z` : d);
  return Number.isNaN(x.getTime()) ? null : x;
}

export function formatDate(d: Date | string | null | undefined, style: "short" | "long" | "month" = "long"): string {
  const x = toDate(d);
  if (!x) return "";
  const m = x.getUTCMonth();
  if (style === "month") return `${MONTHS_LONG[m]} ${x.getUTCFullYear()}`;
  if (style === "short") return `${x.getUTCDate()} ${MONTHS[m]} ${x.getUTCFullYear()}`;
  return `${MONTHS_LONG[m]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
}

export function formatDateTime(d: Date | string | null | undefined): string {
  const x = toDate(d);
  if (!x) return "";
  return `${formatDate(x, "short")}, ${String(x.getUTCHours()).padStart(2, "0")}:${String(x.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function timeAgo(d: Date | string | null | undefined, now = new Date()): string {
  const x = toDate(d);
  if (!x) return "";
  const s = Math.round((now.getTime() - x.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 60) return `${days}d ago`;
  return formatDate(x, "short");
}

export function periodLabel(start?: string | null, end?: string | null, current?: boolean): string {
  const a = toDate(start);
  const b = toDate(end);
  const f = (x: Date) => `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  if (!a && !b) return current ? "Present" : "";
  if (a && (current || !b)) return `${f(a)} — ${current ? "Present" : ""}`.replace(/ — $/, "");
  if (a && b) return `${f(a)} — ${f(b)}`;
  return b ? f(b) : "";
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatMoney(amount: string | number | null | undefined, currency: "NGN" | "USD"): string {
  if (amount === null || amount === undefined || amount === "") return "On request";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Ticket numbers look like TJ-MR-2026-0042. */
export function ticketNumber(year: number, seq: number): string {
  return `TJ-MR-${year}-${String(seq).padStart(4, "0")}`;
}
export function parseTicketNumber(t: string): { year: number; seq: number } | null {
  const m = /^TJ-MR-(\d{4})-(\d{4,})$/i.exec(t.trim());
  return m ? { year: Number(m[1]), seq: Number(m[2]) } : null;
}

export function isExpired(expiry: string | Date | null | undefined, now = new Date()): boolean {
  const x = toDate(expiry);
  return Boolean(x && x.getTime() < now.getTime());
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function domainOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Safe external URL (http/https/mailto/tel only). */
export function safeUrl(u: string | null | undefined): string | undefined {
  const v = pub(u);
  if (!v) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (v.startsWith("/") && !v.startsWith("//")) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return undefined;
}

export function whatsappLink(number: string | null | undefined, text?: string): string | undefined {
  const n = pub(number)?.replace(/[^\d]/g, "");
  if (!n) return undefined;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export function groupBy<T, K extends string | number>(arr: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of arr) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it);
    else m.set(k, [it]);
  }
  return m;
}
