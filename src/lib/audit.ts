import { db } from "../db/index.js";
import { auditLogs } from "../db/schema/index.js";
import { logger } from "./logger.js";

type Actor = { id: number; name: string } | null | undefined;
const SKIP = new Set(["updatedAt", "createdAt", "bodyJson", "passwordHash", "totpSecret"]);

/** Field-level before/after diff (ignores timestamps and secrets; truncates long values). */
export function diff(before: Record<string, unknown> | null | undefined, after: Record<string, unknown> | null | undefined) {
  const out: Record<string, { before: unknown; after: unknown }> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const norm = (v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string" && v.length > 400) return `${v.slice(0, 400)}…`;
    return v ?? null;
  };
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    const a = norm(before?.[k]);
    const b = norm(after?.[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { before: a, after: b };
  }
  return Object.keys(out).length ? out : null;
}

export async function audit(
  actor: Actor,
  action: string,
  resource: string,
  resourceId: string | number | null,
  opts: { summary?: string; before?: Record<string, unknown> | null; after?: Record<string, unknown> | null; ipHash?: string } = {},
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: actor?.id ?? null,
      userName: actor?.name ?? "system",
      action,
      resource,
      resourceId: resourceId === null ? null : String(resourceId),
      summary: opts.summary?.slice(0, 255) ?? null,
      diff: opts.before !== undefined || opts.after !== undefined ? diff(opts.before, opts.after) : null,
      ipHash: opts.ipHash ?? null,
    });
  } catch (e) {
    logger.error({ err: (e as Error).message }, "audit write failed");
  }
}
