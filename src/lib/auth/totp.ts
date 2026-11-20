import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { randomToken, sha256 } from "../crypto.js";

export const newTotpSecret = (): string => generateSecret();

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const clean = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  try {
    const r = await verify({ secret, token: clean, epochTolerance: 30 });
    return r.valid;
  } catch {
    return false;
  }
}

export async function totpQr(secret: string, email: string, issuer = "Tijani Bulama CMS"): Promise<{ uri: string; svg: string }> {
  const uri = generateURI({ issuer, label: email, secret });
  const svg = await QRCode.toString(uri, { type: "svg", margin: 1, width: 200, color: { dark: "#0B1A2B", light: "#FFFFFF" } });
  return { uri, svg };
}

/** 10 one-time recovery codes like `k3x9-q2mf-7hzp`. Returns plain codes and their hashes. */
export function makeRecoveryCodes(n = 10): Array<{ code: string; hash: string }> {
  return Array.from({ length: n }, () => {
    const raw = randomToken(9).toLowerCase().replace(/[^a-z0-9]/g, "x").slice(0, 12);
    const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
    return { code, hash: sha256(code) };
  });
}
export const normalizeRecovery = (c: string): string => c.trim().toLowerCase().replace(/\s+/g, "");
