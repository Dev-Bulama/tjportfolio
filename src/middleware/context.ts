import type { NextFunction, Request, Response } from "express";
import { appUrl, adminUrl, env, isProd, turnstileConfigured } from "../config/env.js";
import { hmac, ipHash, randomToken, safeEqual } from "../lib/crypto.js";
import { loadSession, SESSION_COOKIE } from "../lib/auth/session.js";
import { logger } from "../lib/logger.js";

export const CSRF_COOKIE = "tj_csrf";

/** Loads the DB session (if any) and derives the request's CSRF token. */
export async function sessionContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.ipHashed = ipHash(req.ip);
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const s = await loadSession(token);
      if (s) {
        req.user = s.user;
        req.session = s.session;
      } else {
        res.clearCookie(SESSION_COOKIE, { path: "/" });
      }
    }
  } catch (e) {
    logger.warn({ err: (e as Error).message }, "session load failed");
  }
  let secret = req.session?.csrfSecret;
  if (!secret) {
    secret = req.cookies?.[CSRF_COOKIE] as string | undefined;
    if (!secret || secret.length < 20) {
      secret = randomToken(24);
      res.cookie(CSRF_COOKIE, secret, { httpOnly: true, sameSite: "lax", secure: isProd, path: "/", maxAge: 7 * 24 * 3600 * 1000 });
    }
  }
  req.csrfToken = hmac(`csrf:${secret}`).slice(0, 48);
  res.locals.csrfToken = req.csrfToken;
  res.locals.user = req.user;
  res.locals.turnstileSiteKey = turnstileConfigured ? env.TURNSTILE_SITE_KEY : "";
  res.locals.appUrl = appUrl;
  res.locals.A = adminUrl;
  res.locals.path = req.path;
  next();
}

export function checkCsrf(req: Request): boolean {
  const sent = (req.body?._csrf as string | undefined) ?? (req.get("x-csrf-token") ?? undefined);
  return typeof sent === "string" && safeEqual(sent, req.csrfToken);
}

const SKIP = [/^\/api\/collect$/, /^\/api\/cron$/];

/** Synchronizer-token CSRF check on every mutating request (multipart routes call checkCsrf after parsing). */
export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (SKIP.some((r) => r.test(req.path))) return next();
  if (req.is("multipart/form-data")) return next();
  if (checkCsrf(req)) return next();
  logger.warn({ path: req.path }, "csrf rejected");
  res.status(403);
  if (req.accepts(["html", "json"]) === "json") {
    res.json({ ok: false, error: "Your session expired. Reload the page and try again." });
    return;
  }
  res.send("Your session expired or the form was open too long. Go back, reload the page and try again.");
}
