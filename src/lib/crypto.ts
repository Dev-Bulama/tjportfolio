import crypto from "node:crypto";
import { env } from "../config/env.js";

export const randomToken = (bytes = 32): string => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = (s: string): string => crypto.createHash("sha256").update(s).digest("hex");
export const hmac = (s: string, key = env.SESSION_SECRET): string =>
  crypto.createHmac("sha256", key).update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** One-way, salted IP hash (no raw IPs are stored anywhere). */
export const ipHash = (ip: string | undefined): string => hmac(`ip:${ip ?? "unknown"}`).slice(0, 32);

/** AES-256-GCM for small secrets at rest (TOTP seeds). Key derived from SESSION_SECRET. */
const key = crypto.createHash("sha256").update(`enc:${env.SESSION_SECRET}`).digest();
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc) throw new Error("bad ciphertext");
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
