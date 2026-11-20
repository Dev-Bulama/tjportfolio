import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";
import { pool } from "./db/index.js";
import { checkStorage } from "./lib/storage/index.js";
import { bootStatus } from "./server/boot.js";
import { ROOT } from "./config/paths.js";

const app = createApp();

async function boot(): Promise<void> {
  // Migrations on boot (no SSH on shared hosting). A failure is logged but doesn't stop the
  // process, so /api/health can report the problem instead of the host showing a 502.
  logger.info({ root: ROOT, cwd: process.cwd() }, "booting");
  try {
    await runMigrations();
    bootStatus.migrations = "ok";
  } catch (e) {
    bootStatus.migrations = "failed";
    bootStatus.migrationError = (e as Error).message.slice(0, 500);
    logger.error({ err: (e as Error).message }, "migrations failed at boot");
  }
  await checkStorage().catch((e) => logger.warn({ err: (e as Error).message }, "storage check failed"));
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "server listening");
});
void boot();

function shutdown(sig: string): void {
  logger.info({ sig }, "shutting down");
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 8000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
