/** Resets the E2E database, runs migrations + seed, and creates an Admin user (no 2FA) for UI tests. */
export const E2E_ADMIN = { email: "e2e-admin@test.local", password: "E2e-Strong-Pass-2026", name: "E2E Admin" };

export default async function globalSetup(): Promise<void> {
  const mysql = await import("mysql2/promise");
  await import("dotenv/config");
  const name = process.env.DATABASE_NAME!;
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? "localhost",
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  });
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await conn.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch {
    // No CREATE/DROP DATABASE privilege: empty the existing database instead.
    await conn.query(`USE \`${name}\``);
    const [rows] = await conn.query("SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()");
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const r of rows as Array<{ t: string }>) await conn.query(`DROP TABLE \`${r.t}\``);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  }
  await conn.end();
  const { runMigrations } = await import("../src/db/migrate.js");
  const { runSeed } = await import("../src/db/seed/index.js");
  const { db, pool } = await import("../src/db/index.js");
  const { users } = await import("../src/db/schema/index.js");
  const { hashPassword } = await import("../src/lib/auth/password.js");
  await runMigrations();
  await runSeed();
  await db.insert(users).values({ ...E2E_ADMIN, passwordHash: await hashPassword(E2E_ADMIN.password), role: "admin" });
  // Publish a few seeded drafts so the public pages have something to show.
  await pool.query("UPDATE projects SET status='published', published_at=NOW() WHERE sort_order < 6");
  await pool.query("UPDATE posts SET status='published', published_at=NOW()");
  await pool.end();
}
