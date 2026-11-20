import { and, eq, gt, lt, ne } from "drizzle-orm";
import { db } from "../../db/index.js";
import { sessions, users } from "../../db/schema/index.js";
import { randomToken, sha256 } from "../crypto.js";

export const SESSION_COOKIE = "tj_session";
export const IDLE_MS = 7 * 24 * 3600 * 1000;
export const ABSOLUTE_MS = 30 * 24 * 3600 * 1000;
const TOUCH_EVERY_MS = 5 * 60 * 1000;

export type SessionUser = Pick<typeof users.$inferSelect, "id" | "email" | "name" | "role" | "totpEnabled">;
export type SessionRow = typeof sessions.$inferSelect;

export async function createSession(
  userId: number,
  meta: { ipHash?: string; userAgent?: string; twoFactorPassed: boolean },
): Promise<{ token: string; session: SessionRow }> {
  const token = randomToken(32);
  const now = new Date();
  const row = {
    id: sha256(token),
    userId,
    twoFactorPassed: meta.twoFactorPassed,
    csrfSecret: randomToken(24),
    ipHash: meta.ipHash ?? null,
    userAgent: meta.userAgent?.slice(0, 255) ?? null,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + ABSOLUTE_MS),
  };
  await db.insert(sessions).values(row);
  return { token, session: row };
}

/** Validates a session token: absolute expiry (30d) and idle expiry (7d). */
export async function loadSession(token: string | undefined): Promise<{ session: SessionRow; user: SessionUser } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const id = sha256(token);
  const rows = await db
    .select({
      session: sessions,
      user: { id: users.id, email: users.email, name: users.name, role: users.role, totpEnabled: users.totpEnabled, isActive: users.isActive },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  const now = Date.now();
  if (!r.user.isActive || r.session.expiresAt.getTime() < now || r.session.lastSeenAt.getTime() + IDLE_MS < now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  if (now - r.session.lastSeenAt.getTime() > TOUCH_EVERY_MS) {
    await db.update(sessions).set({ lastSeenAt: new Date(now) }).where(eq(sessions.id, id));
  }
  const { isActive: _a, ...user } = r.user;
  return { session: r.session, user };
}

export async function markTwoFactorPassed(sessionId: string): Promise<void> {
  await db.update(sessions).set({ twoFactorPassed: true }).where(eq(sessions.id, sessionId));
}

export async function destroySession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function destroyOtherSessions(userId: number, keepId?: string): Promise<void> {
  await db.delete(sessions).where(keepId ? and(eq(sessions.userId, userId), ne(sessions.id, keepId)) : eq(sessions.userId, userId));
}

export async function listSessions(userId: number) {
  return db
    .select({ id: sessions.id, userAgent: sessions.userAgent, createdAt: sessions.createdAt, lastSeenAt: sessions.lastSeenAt, twoFactorPassed: sessions.twoFactorPassed })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())));
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.delete(sessions).where(lt(sessions.lastSeenAt, new Date(Date.now() - IDLE_MS)));
}
