import type { NextFunction, Request, RequestHandler, Response } from "express";
import { adminUrl, isProd } from "../../config/env.js";
import { can, type Action, type Resource } from "../../lib/permissions.js";

export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Flash message shown as a toast on the next page. */
export function flash(res: Response, type: "success" | "error" | "info", msg: string): void {
  res.cookie("tj_flash", JSON.stringify({ type, msg }), { httpOnly: true, sameSite: "lax", secure: isProd, maxAge: 60_000, path: "/" });
}

export function readFlash(req: Request, res: Response, next: NextFunction): void {
  const raw = req.cookies?.tj_flash as string | undefined;
  if (raw) {
    try {
      res.locals.flash = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    res.clearCookie("tj_flash", { path: "/" });
  }
  res.locals.noTrack = true;
  next();
}

/** Signed in, past 2FA, and (for Owners) enrolled in 2FA. Re-checked by every handler via requirePerm. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    const nextUrl = req.method === "GET" ? `?next=${encodeURIComponent(req.originalUrl)}` : "";
    return res.redirect(adminUrl(`/login${nextUrl}`));
  }
  if (req.user.totpEnabled && !req.session.twoFactorPassed) return res.redirect(adminUrl("/2fa"));
  if (req.user.role === "owner" && !req.user.totpEnabled && !req.path.startsWith("/account/2fa") && req.path !== "/logout") {
    flash(res, "info", "Owners must enable two-factor authentication before continuing.");
    return res.redirect(adminUrl("/account/2fa"));
  }
  next();
}

export function allowed(req: Request, action: Action, resource: Resource): boolean {
  return can(req.user, action, resource);
}

export const requirePerm =
  (action: Action, resource: Resource): RequestHandler =>
  (req, res, next) => {
    if (can(req.user, action, resource)) return next();
    res.status(403);
    if (req.accepts(["html", "json"]) === "json") return void res.json({ ok: false, error: "You don't have permission to do that." });
    void res.page("admin/forbidden", { layout: "admin", title: "Not allowed" }, 403).catch(next);
  };

/** For handlers: throws a 403 if not permitted (defence in depth beyond route middleware). */
export function assertCan(req: Request, action: Action, resource: Resource): void {
  if (!can(req.user, action, resource)) {
    const e = new Error("You don't have permission to do that.") as Error & { status: number };
    e.status = 403;
    throw e;
  }
}

export function wantsJson(req: Request): boolean {
  return req.accepts(["html", "json"]) === "json" || req.get("x-requested-with") === "fetch";
}
