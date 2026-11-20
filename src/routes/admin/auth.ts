import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema/index.js";
import { adminUrl } from "../../config/env.js";
import * as A from "../../server/auth.js";
import { destroySession, markTwoFactorPassed, SESSION_COOKIE } from "../../lib/auth/session.js";
import { rateLimit } from "../../lib/rate-limit.js";
import { audit } from "../../lib/audit.js";
import { passwordProblems } from "../../lib/auth/password.js";
import { ah, flash } from "./mw.js";

export const authRouter = Router();

const safeNext = (n: unknown): string => {
  const v = typeof n === "string" ? n : "";
  return v.startsWith(adminUrl("/")) && !v.startsWith("//") ? v : adminUrl("/");
};

authRouter.get("/login", ah(async (req, res) => {
  if (req.user && (!req.user.totpEnabled || req.session?.twoFactorPassed)) return res.redirect(adminUrl("/"));
  await res.page("admin/auth/login", { layout: "auth", title: "Sign in", next: safeNext(req.query.next), email: "" });
}));

authRouter.post("/login", ah(async (req, res) => {
  const email = String(req.body.email ?? "").slice(0, 191);
  const password = String(req.body.password ?? "").slice(0, 200);
  const next = safeNext(req.body.next);
  const ipLimit = await rateLimit("login-ip", req.ipHashed, 20, 15 * 60);
  if (!ipLimit.ok) {
    return res.page("admin/auth/login", { layout: "auth", title: "Sign in", next, email, error: "Too many sign-in attempts from this network. Wait 15 minutes and try again." }, 429);
  }
  const r = await A.attemptLogin(email, password, req.ipHashed);
  if (!r.ok) return res.page("admin/auth/login", { layout: "auth", title: "Sign in", next, email, error: r.error }, r.locked ? 423 : 401);
  if (req.session) await destroySession(req.session.id);
  await A.startSession(req, res, r.userId, !r.needs2fa);
  const u = (await db.select({ id: users.id, name: users.name }).from(users).where(eq(users.id, r.userId)))[0]!;
  await audit(u, "login", "users", u.id, { ipHash: req.ipHashed, summary: r.needs2fa ? "password ok, awaiting 2FA" : "signed in" });
  res.redirect(r.needs2fa ? adminUrl(`/2fa?next=${encodeURIComponent(next)}`) : next);
}));

authRouter.get("/2fa", ah(async (req, res) => {
  if (!req.user || !req.session) return res.redirect(adminUrl("/login"));
  if (!req.user.totpEnabled || req.session.twoFactorPassed) return res.redirect(adminUrl("/"));
  await res.page("admin/auth/twofactor", { layout: "auth", title: "Two-factor authentication", next: safeNext(req.query.next) });
}));

authRouter.post("/2fa", ah(async (req, res) => {
  if (!req.user || !req.session) return res.redirect(adminUrl("/login"));
  const next = safeNext(req.body.next);
  const lim = await rateLimit("2fa", String(req.user.id), 8, 15 * 60);
  if (!lim.ok) return res.page("admin/auth/twofactor", { layout: "auth", title: "Two-factor authentication", next, error: "Too many attempts. Wait 15 minutes." }, 429);
  const kind = await A.verifySecondFactor(req.user.id, String(req.body.code ?? "").slice(0, 40));
  if (!kind) return res.page("admin/auth/twofactor", { layout: "auth", title: "Two-factor authentication", next, error: "That code didn't work. Check your authenticator app's clock, or use a recovery code." }, 401);
  await markTwoFactorPassed(req.session.id);
  await audit(req.user, "2fa_passed", "users", req.user.id, { ipHash: req.ipHashed, summary: kind === "recovery" ? "used a recovery code" : "totp" });
  if (kind === "recovery") flash(res, "info", `Recovery code used — ${await A.remainingRecoveryCodes(req.user.id)} left. Generate new ones under Account if you're running low.`);
  res.redirect(next);
}));

authRouter.post("/logout", ah(async (req, res) => {
  if (req.session) {
    await audit(req.user, "logout", "users", req.user?.id ?? null, { ipHash: req.ipHashed });
    await destroySession(req.session.id);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.redirect(adminUrl("/login"));
}));

authRouter.get("/forgot", ah(async (_req, res) => {
  await res.page("admin/auth/forgot", { layout: "auth", title: "Reset password" });
}));

authRouter.post("/forgot", ah(async (req, res) => {
  const email = String(req.body.email ?? "").slice(0, 191);
  const lim = await rateLimit("reset", req.ipHashed, 5, 60 * 60);
  if (lim.ok && email.includes("@")) await A.requestPasswordReset(email);
  await res.page("admin/auth/forgot", { layout: "auth", title: "Reset password", sent: true });
}));

authRouter.get("/reset/:token", ah(async (req, res) => {
  const r = await A.findReset(String(req.params.token));
  await res.page("admin/auth/reset", { layout: "auth", title: "Choose a new password", token: req.params.token, invalid: !r });
}));

authRouter.post("/reset/:token", ah(async (req, res) => {
  const token = String(req.params.token);
  const pw = String(req.body.password ?? "");
  const r = await A.findReset(token);
  if (!r) return res.page("admin/auth/reset", { layout: "auth", title: "Choose a new password", token, invalid: true }, 400);
  const u = (await db.select().from(users).where(eq(users.id, r.userId)))[0]!;
  const problems = passwordProblems(pw, { email: u.email, name: u.name });
  if (pw !== String(req.body.confirm ?? "")) problems.push("The two passwords don't match.");
  if (problems.length) return res.page("admin/auth/reset", { layout: "auth", title: "Choose a new password", token, problems }, 400);
  await A.completeReset(token, pw);
  await audit({ id: u.id, name: u.name }, "password_reset", "users", u.id, { ipHash: req.ipHashed });
  flash(res, "success", "Password changed. Sign in with your new password.");
  res.redirect(adminUrl("/login"));
}));
