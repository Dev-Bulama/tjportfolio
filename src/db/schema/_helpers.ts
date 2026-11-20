import { bigint, boolean, int, mysqlEnum, timestamp, varchar } from "drizzle-orm/mysql-core";

export const id = () => bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey();
export const fk = (name: string) => bigint(name, { mode: "number", unsigned: true });
export const ts = (name: string) => timestamp(name, { mode: "date" });

export const timestamps = {
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow().onUpdateNow(),
};

export const STATUS = ["draft", "published", "scheduled"] as const;
export type Status = (typeof STATUS)[number];

/** Columns shared by every publishable content table. */
export const content = () => ({
  status: mysqlEnum("status", STATUS).notNull().default("draft"),
  publishedAt: ts("published_at"),
  featured: boolean("featured").notNull().default(false),
  sortOrder: int("sort_order").notNull().default(0),
  isSample: boolean("is_sample").notNull().default(false),
  ...timestamps,
  deletedAt: ts("deleted_at"),
});

export const seo = () => ({
  seoTitle: varchar("seo_title", { length: 191 }),
  seoDescription: varchar("seo_description", { length: 320 }),
  ogImageId: fk("og_image_id"),
});
