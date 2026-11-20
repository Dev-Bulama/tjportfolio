import { boolean, index, int, json, mysqlEnum, mysqlTable, primaryKey, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { content, fk, id, seo, timestamps, ts } from "./_helpers.js";

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: json("value").$type<unknown>().notNull(),
  updatedAt: ts("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const socialLinks = mysqlTable("social_links", {
  id: id(),
  platform: varchar("platform", { length: 40 }).notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  url: varchar("url", { length: 500 }).notNull(),
  icon: varchar("icon", { length: 60 }),
  ...content(),
});

export const stats = mysqlTable("stats", {
  id: id(),
  label: varchar("label", { length: 80 }).notNull(),
  value: int("value").notNull().default(0),
  suffix: varchar("suffix", { length: 10 }),
  icon: varchar("icon", { length: 60 }),
  ...content(),
});

export const homepageSections = mysqlTable(
  "homepage_sections",
  {
    id: id(),
    key: varchar("key", { length: 40 }).notNull(),
    title: varchar("title", { length: 191 }).notNull(),
    kicker: varchar("kicker", { length: 80 }),
    intro: text("intro"),
    ...content(),
  },
  (t) => [uniqueIndex("homepage_sections_key_uq").on(t.key)],
);

export const CATEGORY_TYPES = ["project", "training", "certification", "post", "service_type", "album", "faq"] as const;
export const categories = mysqlTable(
  "categories",
  {
    id: id(),
    type: mysqlEnum("type", CATEGORY_TYPES).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description"),
    ...content(),
  },
  (t) => [uniqueIndex("categories_type_slug_uq").on(t.type, t.slug)],
);

export const tags = mysqlTable(
  "tags",
  {
    id: id(),
    name: varchar("name", { length: 80 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tags_slug_uq").on(t.slug)],
);

export const taggables = mysqlTable(
  "taggables",
  {
    tagId: fk("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    taggableType: varchar("taggable_type", { length: 40 }).notNull(),
    taggableId: fk("taggable_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.tagId, t.taggableType, t.taggableId] }), index("taggables_target_idx").on(t.taggableType, t.taggableId)],
);

export const pages = mysqlTable(
  "pages",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("pages_slug_uq").on(t.slug), index("pages_status_idx").on(t.status, t.publishedAt)],
);

export const pageBlocks = mysqlTable(
  "page_blocks",
  {
    id: id(),
    pageId: fk("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    data: json("data").$type<Record<string, unknown>>().notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("page_blocks_page_idx").on(t.pageId, t.sortOrder)],
);

export const menus = mysqlTable(
  "menus",
  {
    id: id(),
    key: varchar("key", { length: 40 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("menus_key_uq").on(t.key)],
);

export const menuItems = mysqlTable(
  "menu_items",
  {
    id: id(),
    menuId: fk("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    parentId: fk("parent_id"),
    label: varchar("label", { length: 80 }).notNull(),
    href: varchar("href", { length: 500 }).notNull(),
    newTab: boolean("new_tab").notNull().default(false),
    visible: boolean("visible").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("menu_items_menu_idx").on(t.menuId, t.sortOrder)],
);
