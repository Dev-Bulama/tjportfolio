import path from "node:path";
import { z } from "zod";
import { ROOT } from "./paths.js";
import dotenv from "dotenv";

// Real environment variables always win; .env in the working directory, then the app folder, fill gaps.
dotenv.config({ quiet: true });
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");
/**
 * Optional values. Hosting panels that refuse empty variables can use one of these words to mean
 * "not set": none, null, off, disabled, false, - (case-insensitive).
 */
export const UNSET = /^(none|null|off|disabled|false|-)$/i;
const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" && !UNSET.test(v.trim()) ? v.trim() : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    APP_URL: z.string().url().default("http://localhost:3000"),
    ADMIN_PATH: z
      .string()
      .regex(/^[a-z0-9][a-z0-9-]{1,40}$/i, "letters, digits and dashes only")
      .default("admin"),
    SESSION_SECRET: z.string().min(32, "must be at least 32 characters (64+ recommended)"),
    SETUP_TOKEN: optional,
    DATABASE_HOST: z.string().default("localhost"),
    DATABASE_PORT: z.coerce.number().int().default(3306),
    DATABASE_NAME: z.string().min(1),
    DATABASE_USER: z.string().min(1),
    DATABASE_PASSWORD: z.string().default(""),
    DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(10).default(5),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: optional,
    S3_ENDPOINT: optional,
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: optional,
    S3_ACCESS_KEY_ID: optional,
    S3_SECRET_ACCESS_KEY: optional,
    S3_PUBLIC_URL: optional,
    SMTP_HOST: z.string().default("smtp.hostinger.com"),
    SMTP_PORT: z.coerce.number().int().default(465),
    SMTP_SECURE: bool.default(true),
    SMTP_USER: optional,
    SMTP_PASSWORD: optional,
    MAIL_FROM: optional,
    ADMIN_NOTIFY_EMAIL: optional,
    TURNSTILE_SITE_KEY: optional,
    TURNSTILE_SECRET_KEY: optional,
    CRON_SECRET: optional,
    ANALYTICS_SALT: z.string().min(8).default("change-me-analytics-salt"),
    TRUST_PROXY: z.string().default("1"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  })
  .superRefine((v, ctx) => {
    if (v.STORAGE_DRIVER === "s3") {
      for (const k of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const) {
        if (!v[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when STORAGE_DRIVER=s3" });
      }
    }
  });

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
    const msg = `\n✖ Invalid or missing environment variables:\n${lines.join("\n")}\n\nSee .env.example for the full list.\n`;
    console.error(msg);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export const env = load();

export const isProd = env.NODE_ENV === "production";
export const appUrl = env.APP_URL.replace(/\/$/, "");
/** Absolute directory for uploads. Defaults to ../portfolio-storage (outside the app folder). */
export const uploadDir = path.resolve(env.UPLOAD_DIR ?? path.join(ROOT, "..", "portfolio-storage"));
export const smtpConfigured = Boolean(env.SMTP_USER && env.SMTP_PASSWORD);
export const turnstileConfigured = Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY);
export const adminBase = `/${env.ADMIN_PATH}`;
export function adminUrl(p = ""): string {
  return `${adminBase}${p && !p.startsWith("/") ? "/" : ""}${p}`;
}
