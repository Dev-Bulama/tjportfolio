import { env, uploadDir } from "../../config/env.js";
import { logger } from "../logger.js";
import { LocalStorage } from "./local.js";
import { S3Storage } from "./s3.js";
import type { StorageDriver } from "./types.js";

export type { StorageDriver };

const local = new LocalStorage(uploadDir);
let s3: S3Storage | null = null;

export function driver(name: "local" | "s3" = env.STORAGE_DRIVER): StorageDriver {
  if (name === "local") return local;
  if (!s3) {
    if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
      throw new Error("S3 storage is not configured");
    }
    s3 = new S3Storage({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    });
  }
  return s3;
}

export const s3Configured = (): boolean => Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);

let lastHealth: { ok: boolean; detail: string; driver: string; checkedAt: Date } | null = null;

export async function checkStorage() {
  const d = driver();
  const h = await d.health();
  lastHealth = { ...h, driver: d.name, checkedAt: new Date() };
  if (!h.ok) logger.warn({ detail: h.detail }, "storage health warning");
  return lastHealth;
}

export function storageHealth() {
  return lastHealth;
}
