import { date, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, varchar } from "drizzle-orm/mysql-core";
import { id, ts } from "./_helpers.js";

export const analyticsHits = mysqlTable(
  "analytics_hits",
  {
    id: id(),
    ts: ts("ts").notNull().defaultNow(),
    path: varchar("path", { length: 255 }).notNull(),
    referrer: varchar("referrer", { length: 191 }),
    utmSource: varchar("utm_source", { length: 100 }),
    utmMedium: varchar("utm_medium", { length: 100 }),
    utmCampaign: varchar("utm_campaign", { length: 100 }),
    device: varchar("device", { length: 16 }),
    browser: varchar("browser", { length: 32 }),
    os: varchar("os", { length: 32 }),
    country: varchar("country", { length: 8 }),
    visitorHash: varchar("visitor_hash", { length: 64 }).notNull(),
  },
  (t) => [index("hits_ts_idx").on(t.ts), index("hits_path_idx").on(t.path, t.ts)],
);

export const analyticsEvents = mysqlTable(
  "analytics_events",
  {
    id: id(),
    ts: ts("ts").notNull().defaultNow(),
    name: varchar("name", { length: 60 }).notNull(),
    path: varchar("path", { length: 255 }),
    label: varchar("label", { length: 255 }),
    visitorHash: varchar("visitor_hash", { length: 64 }),
    meta: json("meta").$type<Record<string, unknown>>(),
  },
  (t) => [index("events_ts_idx").on(t.ts), index("events_name_idx").on(t.name, t.ts)],
);

/** Roll-up table: one row per (day, kind, key). kind ∈ pageviews|visitors|path|referrer|country|device|browser|os|utm|event */
export const analyticsDaily = mysqlTable(
  "analytics_daily",
  {
    day: date("day", { mode: "string" }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull(),
    key: varchar("key", { length: 191 }).notNull().default(""),
    value: int("value").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.kind, t.key] })],
);

export const rateLimits = mysqlTable("rate_limits", {
  key: varchar("key", { length: 191 }).primaryKey(),
  count: int("count").notNull().default(0),
  resetAt: ts("reset_at").notNull(),
});

export const jobs = mysqlTable(
  "jobs",
  {
    id: id(),
    type: varchar("type", { length: 40 }).notNull(),
    payload: json("payload").$type<Record<string, unknown>>().notNull(),
    status: mysqlEnum("status", ["pending", "done", "failed"]).notNull().default("pending"),
    attempts: int("attempts").notNull().default(0),
    runAt: ts("run_at").notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [index("jobs_status_idx").on(t.status, t.runAt)],
);
