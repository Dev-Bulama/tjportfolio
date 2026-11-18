import { index, int, json, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { fk, id, ts } from "./_helpers.js";

export type MediaVariant = { width: number; height: number; key: string; size: number };

export const media = mysqlTable(
  "media",
  {
    id: id(),
    driver: mysqlEnum("driver", ["local", "s3"]).notNull().default("local"),
    key: varchar("key", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mime: varchar("mime", { length: 100 }).notNull(),
    size: int("size").notNull(),
    width: int("width"),
    height: int("height"),
    blurDataUrl: text("blur_data_url"),
    variants: json("variants").$type<MediaVariant[]>(),
    alt: varchar("alt", { length: 255 }),
    caption: varchar("caption", { length: 500 }),
    credit: varchar("credit", { length: 191 }),
    checksum: varchar("checksum", { length: 64 }),
    folder: varchar("folder", { length: 40 }).notNull().default("library"),
    albumId: fk("album_id"),
    albumOrder: int("album_order").notNull().default(0),
    createdBy: fk("created_by"),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow().onUpdateNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    uniqueIndex("media_key_uq").on(t.key),
    index("media_album_idx").on(t.albumId, t.albumOrder),
    index("media_folder_idx").on(t.folder),
  ],
);

export const mediaUsages = mysqlTable(
  "media_usages",
  {
    id: id(),
    mediaId: fk("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    resource: varchar("resource", { length: 40 }).notNull(),
    resourceId: fk("resource_id").notNull(),
    field: varchar("field", { length: 60 }).notNull(),
  },
  (t) => [index("media_usages_media_idx").on(t.mediaId), index("media_usages_res_idx").on(t.resource, t.resourceId)],
);
