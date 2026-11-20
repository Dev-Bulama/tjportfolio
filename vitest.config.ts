import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30000,
  },
});
