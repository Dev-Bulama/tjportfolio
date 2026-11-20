import { and, eq, gt, isNull } from "drizzle-orm";
import type { Request, Response } from "express";
import { db } from "../db/index.js";
import { loginAttempts, passwordResets, recoveryCodes, users } from "../db/schema/index.js";
import { adminUrl, appUrl, isProd } from "../config/env.js";
import { decrypt, encrypt, randomToken, sha256 } from "../lib/crypto.js";
import { hashPassword, verifyPassword } from "../lib/auth/password.js";
import { createSession, destroyOtherSessions, SESSION_COOKIE, ABSOLUTE_MS } from "../lib/auth/session.js";
import { makeRecoveryCodes, newTotpSecret, normalizeRecovery, verifyTotp } from "../lib/auth/totp.js";
import { sendEmail } from "../lib/jobs.js";
import { T } from "../lib/mail/templates.js";
import { audit } from "../lib/audit.js";
import { formatDateTime } from "../lib/util.js";

export const MAX_FAILED = 5;
export const LOCK_MINUTES = 15;
// Fixed dummy hash so unknown emails cost the same time as real ones (no user enumeration by timing).
let dummyHash: Promise<string> | null = null;
const dummy = (): Promise<string> => (dummyHash ??= hashPassword(randomToken(16)));

export type LoginResult =
  | { ok: true; userId: number; needs2fa: boolean }
  | { ok: false; error: string; locked?: boolean };

export async function attemptLogin(emailRaw: string, password: string, ipHash: string): Promise<LoginResult> {
  const email = emailRaw.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  const generic = "Email or password is incorrect.";
  if (!user || !user.isActive) {
    await verifyPassword(await dummy(), password);
    await db.insert(loginAttempts).values({ email, ipHash, success: false });
    return { ok: false, error: generic };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { ok: false, locked: true, error: `Too many failed attempts. Try again after ${formatDateTime(user.lockedUntil)}.` };
  }
  const valid = await verifyPassword(user.passwordHash, password);
  await db.insert(loginAttempts).values({ email, ipHash, success: valid });
  if (!valid) {
    const failed = user.failedAttempts + 1;
    const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null;
    await db.update(users).set({ failedAttempts: lock ? 0 : failed, lockedUntil: lock }).where(eq(users.id, user.id));
    if (lock) {
      await audit({ id: user.id, name: user.name }, "lockout", "users", user.id, { ipHash });
      const owner = (await db.select({ email: users.email }).from(users).where(eq(users.role, "owner")).limit(1))[0];
      await sendEmail(owner?.email, T.lockoutAlert(user.email, formatDateTime(lock)));
      return { ok: false, locked: true, error: `Too many failed attempts. The account is locked for ${LOCK_MINUTES} minutes.` };
    }
    return { ok: false, error: generic };
  }
  await db.update(users).set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return { ok: true, userId: user.id, needs2fa: user.totpEnabled };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: ABSOLUTE_MS });
}

export async function startSession(req: Request, res: Response, userId: number, twoFactorPassed: boolean): Promise<void> {
  const { token } = await createSession(userId, { ipHash: req.ipHashed, userAgent: req.get("user-agent"), twoFactorPassed });
  setSessionCookie(res, token);
}

// ── 2FA ───────────────────────────────────────────────────────────────────────────────────────────
export async function beginTotpEnrolment(userId: number): Promise<string> {
  const secret = newTotpSecret();
  await db.update(users).set({ totpSecret: encrypt(secret), totpEnabled: false }).where(eq(users.id, userId));
  return secret;
}

export async function pendingTotpSecret(userId: number): Promise<string | null> {
  const u = (await db.select({ s: users.totpSecret }).from(users).where(eq(users.id, userId)))[0];
  if (!u?.s) return null;
  try {
    return decrypt(u.s);
  } catch {
    return null;
  }
}

/** Confirms enrolment with a first code; returns plain recovery codes (shown once). */
export async function confirmTotp(userId: number, code: string): Promise<string[] | null> {
  const secret = await pendingTotpSecret(userId);
  if (!secret || !(await verifyTotp(secret, code))) return null;
  const codes = makeRecoveryCodes(10);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ totpEnabled: true }).where(eq(users.id, userId));
    await tx.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
    await tx.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: c.hash })));
  });
  const u = (await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, userId)))[0]!;
  await sendEmail(u.email, T.twoFactorEnabled(u.name));
  return codes.map((c) => c.code);
}

export async function regenerateRecoveryCodes(userId: number): Promise<string[]> {
  const codes = makeRecoveryCodes(10);
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
  await db.insert(recoveryCodes).values(codes.map((c) => ({ userId, codeHash: c.hash })));
  return codes.map((c) => c.code);
}

/** Verifies a TOTP code or a single-use recovery code. */
export async function verifySecondFactor(userId: number, input: string): Promise<"totp" | "recovery" | null> {
  const secret = await pendingTotpSecret(userId);
  if (secret && (await verifyTotp(secret, input))) return "totp";
  const h = sha256(normalizeRecovery(input));
  const code = (
    await db
      .select()
      .from(recoveryCodes)
      .where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, h), isNull(recoveryCodes.usedAt)))
      .limit(1)
  )[0];
  if (!code) return null;
  await db.update(recoveryCodes).set({ usedAt: new Date() }).where(eq(recoveryCodes.id, code.id));
  return "recovery";
}

export async function remainingRecoveryCodes(userId: number): Promise<number> {
  return (await db.select({ id: recoveryCodes.id }).from(recoveryCodes).where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)))).length;
}

export async function disableTotp(userId: number): Promise<void> {
  await db.update(users).set({ totpEnabled: false, totpSecret: null }).where(eq(users.id, userId));
  await db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
}

// ── Password reset ────────────────────────────────────────────────────────────────────────────────
export async function requestPasswordReset(emailRaw: string): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const user = (await db.select().from(users).where(and(eq(users.email, email), eq(users.isActive, true))).limit(1))[0];
  if (!user) return; // same response either way
  const token = randomToken(32);
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60_000) });
  await sendEmail(user.email, T.passwordReset(user.name, `${appUrl}${adminUrl(`/reset/${token}`)}`));
}

export async function findReset(token: string) {
  return (
    await db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, sha256(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())))
      .limit(1)
  )[0];
}

export async function completeReset(token: string, password: string): Promise<number | null> {
  const r = await findReset(token);
  if (!r) return null;
  await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, r.id));
  await db.update(users).set({ passwordHash: await hashPassword(password), failedAttempts: 0, lockedUntil: null }).where(eq(users.id, r.userId));
  await destroyOtherSessions(r.userId);
  return r.userId;
}
