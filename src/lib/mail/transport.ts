import nodemailer, { type Transporter } from "nodemailer";
import { env, smtpConfigured } from "../../config/env.js";

let transporter: Transporter | null = null;

export function mailer(): Transporter | null {
  if (!smtpConfigured) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export const mailFrom = (): string => env.MAIL_FROM ?? `Tijani Bulama <${env.SMTP_USER ?? "no-reply@localhost"}>`;
