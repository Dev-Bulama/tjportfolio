import { boolean, index, int, json, mysqlEnum, mysqlTable, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { fk, id, timestamps, ts } from "./_helpers.js";

export const ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const users = mysqlTable(
  "users",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    name: varchar("name", { length: 191 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ROLES).notNull().default("editor"),
    totpSecret: varchar("totp_secret", { length: 255 }),
    totpEnabled: boolean("totp_enabled").notNull().default(false),
    failedAttempts: int("failed_attempts").notNull().default(0),
    lockedUntil: ts("locked_until"),
    lastLoginAt: ts("last_login_at"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(), // sha256(token)
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    twoFactorPassed: boolean("two_factor_passed").notNull().default(false),
    csrfSecret: varchar("csrf_secret", { length: 64 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const passwordResets = mysqlTable(
  "password_resets",
  {
    id: id(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_resets_token_uq").on(t.tokenHash)],
);

export const recoveryCodes = mysqlTable(
  "recovery_codes",
  {
    id: id(),
    userId: fk("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    usedAt: ts("used_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("recovery_codes_user_idx").on(t.userId)],
);

export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    ipHash: varchar("ip_hash", { length: 64 }),
    success: boolean("success").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("login_attempts_email_idx").on(t.email, t.createdAt)],
);

export const auditLogs = mysqlTable(
  "audit_logs",
  {
    id: id(),
    userId: fk("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: varchar("user_name", { length: 191 }),
    action: varchar("action", { length: 64 }).notNull(),
    resource: varchar("resource", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }),
    summary: varchar("summary", { length: 255 }),
    diff: json("diff").$type<Record<string, { before: unknown; after: unknown }> | null>(),
    ipHash: varchar("ip_hash", { length: 64 }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("audit_resource_idx").on(t.resource, t.resourceId),
    index("audit_created_idx").on(t.createdAt),
    index("audit_user_idx").on(t.userId),
  ],
);

