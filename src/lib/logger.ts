import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: process.env.VITEST ? "silent" : env.LOG_LEVEL,
  base: { app: "tj-portfolio" },
  redact: ["req.headers.cookie", "password", "*.password", "token"],
});
