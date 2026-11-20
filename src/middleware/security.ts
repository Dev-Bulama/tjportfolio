import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { env, isProd } from "../config/env.js";

const s3Host = env.S3_PUBLIC_URL ? new URL(env.S3_PUBLIC_URL).origin : null;

export function nonce(_req: Request, res: Response, next: NextFunction): void {
  res.locals.nonce = crypto.randomBytes(16).toString("base64");
  next();
}

/** Security headers with a nonce-based script CSP (brief §9). */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (_req, res) => `'nonce-${(res as Response).locals.nonce}'`, "https://challenges.cloudflare.com"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:", ...(s3Host ? [s3Host] : []), "https://i.ytimg.com"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", "https://challenges.cloudflare.com"],
      mediaSrc: ["'self'", ...(s3Host ? [s3Host] : [])],
      frameSrc: [
        "https://challenges.cloudflare.com",
        "https://www.youtube-nocookie.com",
        "https://www.youtube.com",
        "https://player.vimeo.com",
        "https://calendly.com",
        "https://cal.com",
        "https://app.cal.com",
        "https://www.google.com",
        "https://maps.google.com",
        "'self'",
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      ...(isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },
  strictTransportSecurity: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: false } : false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
  xFrameOptions: { action: "deny" },
});

export function permissionsPolicy(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()");
  next();
}
