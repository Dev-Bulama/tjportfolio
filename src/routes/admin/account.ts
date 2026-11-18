import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sessions, users } from "../../db/schema/index.js";
import { adminUrl } from "../../config/env.js";
import * as A from "../../server/auth.js";
import { totpQr } from "../../lib/auth/totp.js";
import { hashPassword, passwordProblems, verifyPassword } from "../../lib/auth/password.js";
import { destroyOtherSessions, listSessions } from "../../lib/auth/session.js";
import { audit } from "../../lib/audit.js";
import { ah, flash } from "./mw.js";

export const accountRouter = Router();

accountRouter.get("/account", ah(async (req, res) => {
  const u = req.user!;
  const [list, remaining] = await Promise.all([listSessions(u.id), A.remainingRecoveryCodes(u.id)]);
  await res.page("admin/account/index", { layout: "admin", title: "Account & security", sessions: list, currentSession: req.session!.id, remaining });
}));

accountRouter.post("/account/profile", ah(async (req, res) => {
  const name = String(req.body.name ?? "").trim().slice(0, 191);
  if (!name) {
    flash(res, "error", "Name is required.");
    return res.redirect(adminUrl("/account"));
  }
  await db.update(users).set({ name }).where(eq(users.id, req.user!.id));
  await audit(req.user, "update", "users", req.user!.id, { summary: "changed display name", ipHash: req.ipHashed });
  flash(res, "success", "Profile updated.");
  res.redirect(adminUrl("/account"));
}));

accountRouter.post("/account/password", ah(async (req, res) => {
  const u = (await db.select().from(users).where(eq(users.id, req.user!.id)))[0]!;
  const current = String(req.body.current ?? "");
  const pw = String(req.body.password ?? "");
  if (!(await verifyPassword(u.passwordHash, current))) {
    flash(res, "error", "Your current password is incorrect.");
    return res.redirect(adminUrl("/account"));
  }
  const problems = passwordProblems(pw, { email: u.email, name: u.name });
  if (pw !== String(req.body.confirm ?? "")) problems.push("The two passwords don't match.");
  if (problems.length) {
    flash(res, "error", problems.join(" "));
    return res.redirect(adminUrl("/account"));
  }
  await db.update(users).set({ passwordHash: await hashPassword(pw) }).where(eq(users.id, u.id));
  await destroyOtherSessions(u.id, req.session!.id);
  await audit(req.user, "password_change", "users", u.id, { ipHash: req.ipHashed });
  flash(res, "success", "Password changed. Other devices were signed out.");
  res.redirect(adminUrl("/account"));
}));

accountRouter.get("/account/2fa", ah(async (req, res) => {
  const u = req.user!;
  if (u.totpEnabled) return res.redirect(adminUrl("/account"));
  const secret = (await A.pendingTotpSecret(u.id)) ?? (await A.beginTotpEnrolment(u.id));
  const qr = await totpQr(secret, u.email);
  await res.page("admin/account/twofactor", { layout: "admin", title: "Set up two-factor authentication", secret, qr: qr.svg, forced: u.role === "owner" });
}));

accountRouter.post("/account/2fa", ah(async (req, res) => {
  const u = req.user!;
  const codes = await A.confirmTotp(u.id, String(req.body.code ?? ""));
  if (!codes) {
    flash(res, "error", "That code didn't match. Make sure your phone's clock is correct and try the newest code.");
    return res.redirect(adminUrl("/account/2fa"));
  }
  await db.update(sessions).set({ twoFactorPassed: true }).where(eq(sessions.id, req.session!.id));
  await audit(u, "2fa_enabled", "users", u.id, { ipHash: req.ipHashed });
  await res.page("admin/account/recovery", { layout: "admin", title: "Your recovery codes", codes });
}));

accountRouter.post("/account/recovery", ah(async (req, res) => {
  const u = req.user!;
  if (!(await A.verifySecondFactor(u.id, String(req.body.code ?? "")))) {
    flash(res, "error", "Enter a valid authenticator code to generate new recovery codes.");
    return res.redirect(adminUrl("/account"));
  }
  const codes = await A.regenerateRecoveryCodes(u.id);
  await audit(u, "recovery_regenerated", "users", u.id, { ipHash: req.ipHashed });
  await res.page("admin/account/recovery", { layout: "admin", title: "Your recovery codes", codes });
}));

accountRouter.post("/account/2fa/disable", ah(async (req, res) => {
  const u = req.user!;
  if (u.role === "owner") {
    flash(res, "error", "Two-factor authentication is mandatory for the Owner account.");
    return res.redirect(adminUrl("/account"));
  }
  if (!(await A.verifySecondFactor(u.id, String(req.body.code ?? "")))) {
    flash(res, "error", "Enter a valid code to turn off two-factor authentication.");
    return res.redirect(adminUrl("/account"));
  }
  await A.disableTotp(u.id);
  await audit(u, "2fa_disabled", "users", u.id, { ipHash: req.ipHashed });
  flash(res, "success", "Two-factor authentication turned off.");
  res.redirect(adminUrl("/account"));
}));

accountRouter.post("/account/sessions/:id/revoke", ah(async (req, res) => {
  await db.delete(sessions).where(and(eq(sessions.id, String(req.params.id)), eq(sessions.userId, req.user!.id)));
  await audit(req.user, "session_revoked", "users", req.user!.id, { ipHash: req.ipHashed });
  flash(res, "success", "Device signed out.");
  res.redirect(adminUrl("/account"));
}));

accountRouter.post("/account/sessions/revoke-others", ah(async (req, res) => {
  await destroyOtherSessions(req.user!.id, req.session!.id);
  await audit(req.user, "sessions_revoked", "users", req.user!.id, { ipHash: req.ipHashed });
  flash(res, "success", "All other devices were signed out.");
  res.redirect(adminUrl("/account"));
}));
