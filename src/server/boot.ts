/** What happened during boot, reported by /api/health so problems on the host are visible. */
export const bootStatus: { migrations: "pending" | "ok" | "failed"; migrationError?: string; startedAt: string } = {
  migrations: "pending",
  startedAt: new Date().toISOString(),
};
