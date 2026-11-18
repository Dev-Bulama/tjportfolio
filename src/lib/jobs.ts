import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { jobs } from "../db/schema/index.js";
import { logger } from "./logger.js";
import { mailer, mailFrom } from "./mail/transport.js";
import { renderEmail, type EmailContent } from "./mail/templates.js";
import { env } from "../config/env.js";

type EmailPayload = { to: string; replyTo?: string; content: EmailContent };
const MAX_ATTEMPTS = 6;

async function deliver(p: EmailPayload): Promise<void> {
  const t = mailer();
  if (!t) throw new Error("SMTP not configured");
  const { subject, html, text } = await renderEmail(p.content);
  await t.sendMail({ from: mailFrom(), to: p.to, replyTo: p.replyTo, subject, html, text });
}

/**
 * Stores the email as a job first (so nothing is lost if SMTP is down), then tries to send it
 * immediately. Failures stay pending and are retried with backoff by /api/cron.
 */
export async function sendEmail(to: string | undefined | null, content: EmailContent, replyTo?: string): Promise<boolean> {
  if (!to) return false;
  const payload: EmailPayload = { to, content, ...(replyTo ? { replyTo } : {}) };
  const [res] = await db.insert(jobs).values({ type: "email", payload });
  const id = res.insertId;
  try {
    await deliver(payload);
    await db.update(jobs).set({ status: "done", attempts: 1 }).where(eq(jobs.id, id));
    return true;
  } catch (e) {
    await db
      .update(jobs)
      .set({ attempts: 1, lastError: (e as Error).message.slice(0, 1000), runAt: new Date(Date.now() + 5 * 60_000) })
      .where(eq(jobs.id, id));
    logger.warn({ err: (e as Error).message, to }, "email queued for retry");
    return false;
  }
}

export const notifyAdmin = (content: EmailContent): Promise<boolean> => sendEmail(env.ADMIN_NOTIFY_EMAIL ?? env.SMTP_USER, content);

/** Processes due jobs (called from cron). Exponential backoff: 5m, 20m, 80m… */
export async function runJobs(limit = 25): Promise<{ sent: number; failed: number }> {
  const due = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "pending"), lte(jobs.runAt, sql`NOW()`)))
    .orderBy(asc(jobs.runAt))
    .limit(limit);
  let sent = 0;
  let failed = 0;
  for (const j of due) {
    try {
      if (j.type === "email") await deliver(j.payload as unknown as EmailPayload);
      await db.update(jobs).set({ status: "done", attempts: j.attempts + 1 }).where(eq(jobs.id, j.id));
      sent++;
    } catch (e) {
      const attempts = j.attempts + 1;
      await db
        .update(jobs)
        .set({
          attempts,
          status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
          lastError: (e as Error).message.slice(0, 1000),
          runAt: new Date(Date.now() + 5 * 60_000 * 4 ** Math.min(attempts - 1, 4)),
        })
        .where(eq(jobs.id, j.id));
      failed++;
    }
  }
  return { sent, failed };
}
