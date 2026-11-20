import { env, turnstileConfigured } from "../config/env.js";
import { logger } from "./logger.js";

/** Verifies a Cloudflare Turnstile token. When keys aren't configured (local dev), returns true. */
export async function verifyTurnstile(token: unknown, ip?: string): Promise<boolean> {
  if (!turnstileConfigured) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY!, response: token, ...(ip ? { remoteip: ip } : {}) });
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await r.json()) as { success?: boolean };
    return data.success === true;
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "turnstile verification failed");
    return false;
  }
}
