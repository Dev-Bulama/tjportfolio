import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E + accessibility suite (brief §13). Runs the real server against a dedicated
 * database (E2E_DATABASE_NAME, default tjportfolio_e2e) that e2e/global-setup.ts resets and seeds.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export const E2E_ENV = {
  NODE_ENV: "test",
  PORT: String(PORT),
  APP_URL: `http://localhost:${PORT}`,
  DATABASE_NAME: process.env.E2E_DATABASE_NAME ?? "tjportfolio_e2e",
  UPLOAD_DIR: process.env.E2E_UPLOAD_DIR ?? "/tmp/tj-e2e-uploads",
  SETUP_TOKEN: "",
  CRON_SECRET: "e2e-cron-secret",
};
Object.assign(process.env, E2E_ENV);

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "off", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile/ },
  ],
  webServer: {
    command: "npx tsx src/server.ts",
    url: `http://localhost:${PORT}/robots.txt`, // DB-independent; global setup creates the DB after the server starts
    reuseExistingServer: false,
    timeout: 60_000,
    env: E2E_ENV,
  },
});
