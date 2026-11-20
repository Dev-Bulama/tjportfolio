import { z, type ZodType } from "zod";

export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

export function parse<T>(schema: ZodType<T>, input: unknown): Parsed<T> {
  const r = schema.safeParse(input);
  if (r.success) return { ok: true, data: r.data };
  const errors: FieldErrors = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join(".") || "_form";
    errors[key] ??= issue.message;
  }
  return { ok: false, errors };
}

// Reusable field schemas — the same schemas validate client and server.
const trimmed = z.string().transform((s) => s.trim());
export const str = (max = 191, label = "This field") =>
  trimmed.pipe(z.string().min(1, `${label} is required.`).max(max, `${label} is too long (max ${max}).`));
export const optStr = (max = 191) =>
  z
    .string()
    .nullish()
    .transform((s) => (s ?? "").trim())
    .refine((s) => s.length <= max, `Too long (max ${max}).`)
    .transform((s) => (s === "" ? null : s));
export const email = trimmed.pipe(z.string().toLowerCase().email("Enter a valid email address.").max(191));
export const optInt = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
  .refine((v) => v === null || Number.isFinite(v), "Must be a number.")
  .transform((v) => (v === null ? null : Math.trunc(v as number)));
export const checkbox = z
  .union([z.string(), z.boolean(), z.array(z.string())])
  .optional()
  .transform((v) => (Array.isArray(v) ? v.includes("1") || v.includes("on") || v.includes("true") : v === true || v === "on" || v === "true" || v === "1"));
export const optUrl = z
  .string()
  .nullish()
  .transform((s) => (s ?? "").trim())
  .refine((s) => s === "" || /^\[\[.*\]\]$/.test(s) || /^(https?:\/\/|mailto:|tel:|\/)[^\s]*$/i.test(s), "Enter a full URL starting with https://")
  .transform((s) => (s === "" ? null : s));
export const optDate = z
  .string()
  .nullish()
  .transform((s) => (s ?? "").trim())
  .refine((s) => s === "" || /^\d{4}-\d{2}-\d{2}$/.test(s), "Use the format YYYY-MM-DD.")
  .transform((s) => (s === "" ? null : s));
export const honeypot = z.union([z.literal(""), z.undefined()], { message: "Spam detected." });

export { z };
