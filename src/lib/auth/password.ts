import { hash, verify } from "@node-rs/argon2";

const OPTS = { algorithm: 2 /* Argon2id */, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string): Promise<string> => hash(pw, OPTS);
export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

/** A small list of the most common passwords (lower-cased). */
const COMMON = new Set(
  `123456 123456789 12345678 password qwerty123 qwerty 1q2w3e4r 111111 123123 1234567890 password1 admin123
  welcome welcome1 iloveyou abc123 letmein monkey dragon football baseball master sunshine princess
  passw0rd p@ssw0rd p@ssword admin administrator changeme changeme123 secret 000000 654321 superman
  trustno1 qwertyuiop asdfghjkl zxcvbnm lagos12345 nigeria123 naija123 password123 password@123 test1234`
    .split(/\s+/)
    .filter(Boolean),
);

/** Returns a list of problems; empty means the password is acceptable. */
export function passwordProblems(pw: string, ctx: { email?: string; name?: string } = {}): string[] {
  const problems: string[] = [];
  if (pw.length < 12) problems.push("Use at least 12 characters.");
  if (pw.length > 200) problems.push("Use at most 200 characters.");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) problems.push("Mix at least three of: lowercase, uppercase, numbers, symbols.");
  const low = pw.toLowerCase();
  if (COMMON.has(low) || COMMON.has(low.replace(/[!@#$%^&*.]+$/, ""))) problems.push("This password is too common.");
  const local = ctx.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && low.includes(local)) problems.push("Don't include your email address.");
  if (/(.)\1{3,}/.test(pw)) problems.push("Avoid repeating the same character.");
  return problems;
}
