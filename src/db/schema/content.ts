import {
  boolean,
  date,
  decimal,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { content, fk, id, seo, ts } from "./_helpers.js";
import { categories } from "./site.js";
import { users } from "./auth.js";
import { media } from "./media.js";

export const SKILL_CATEGORIES = [
  "languages",
  "frameworks",
  "databases",
  "cloud",
  "ai_data",
  "methodologies",
  "training",
  "tools",
] as const;

export const skills = mysqlTable(
  "skills",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    category: mysqlEnum("category", SKILL_CATEGORIES).notNull(),
    proficiency: tinyint("proficiency").notNull().default(4),
    years: int("years"),
    iconId: fk("icon_id"),
    showOnHome: boolean("show_on_home").notNull().default(false),
    ...content(),
  },
  (t) => [index("skills_category_idx").on(t.category)],
);

export const projects = mysqlTable(
  "projects",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    categoryId: fk("category_id").references(() => categories.id, { onDelete: "set null" }),
    clientName: varchar("client_name", { length: 191 }),
    clientLogoId: fk("client_logo_id"),
    showClient: boolean("show_client").notNull().default(true),
    role: varchar("role", { length: 191 }),
    year: int("year"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    projectStatus: mysqlEnum("project_status", ["completed", "ongoing", "concept"]).notNull().default("completed"),
    summary: text("summary"),
    bodyJson: json("body_json").$type<unknown>(),
    bodyHtml: longtext("body_html"),
    coverId: fk("cover_id"),
    videoUrl: varchar("video_url", { length: 500 }),
    liveUrl: varchar("live_url", { length: 500 }),
    repoUrl: varchar("repo_url", { length: 500 }),
    appStoreUrl: varchar("app_store_url", { length: 500 }),
    playStoreUrl: varchar("play_store_url", { length: 500 }),
    ...seo(),
    ...content(),
  },
  (t) => [
    uniqueIndex("projects_slug_uq").on(t.slug),
    index("projects_status_idx").on(t.status, t.publishedAt),
    index("projects_category_idx").on(t.categoryId),
  ],
);

export const projectImages = mysqlTable(
  "project_images",
  {
    id: id(),
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    mediaId: fk("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    caption: varchar("caption", { length: 255 }),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("project_images_project_idx").on(t.projectId)],
);

export const projectSkills = mysqlTable(
  "project_skills",
  {
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    skillId: fk("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.skillId] })],
);

export const projectMetrics = mysqlTable(
  "project_metrics",
  {
    id: id(),
    projectId: fk("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 120 }).notNull(),
    value: varchar("value", { length: 60 }).notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("project_metrics_project_idx").on(t.projectId)],
);

export const experiences = mysqlTable("experiences", {
  id: id(),
  organization: varchar("organization", { length: 191 }).notNull(),
  role: varchar("role", { length: 191 }).notNull(),
  location: varchar("location", { length: 120 }),
  startDate: date("start_date", { mode: "string" }),
  endDate: date("end_date", { mode: "string" }),
  isCurrent: boolean("is_current").notNull().default(false),
  periodLabel: varchar("period_label", { length: 80 }),
  description: text("description"),
  logoId: fk("logo_id"),
  url: varchar("url", { length: 500 }),
  isLeadership: boolean("is_leadership").notNull().default(false),
  ...content(),
});

export const education = mysqlTable("education", {
  id: id(),
  institution: varchar("institution", { length: 191 }).notNull(),
  qualification: varchar("qualification", { length: 191 }).notNull(),
  field: varchar("field", { length: 191 }),
  startYear: int("start_year"),
  endYear: int("end_year"),
  notes: text("notes"),
  ...content(),
});

export const trainings = mysqlTable(
  "trainings",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    trackId: fk("track_id").references(() => categories.id, { onDelete: "set null" }),
    clientName: varchar("client_name", { length: 191 }),
    showClient: boolean("show_client").notNull().default(true),
    format: mysqlEnum("format", ["onsite", "virtual", "hybrid"]).notNull().default("onsite"),
    location: varchar("location", { length: 191 }),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    durationLabel: varchar("duration_label", { length: 60 }),
    participants: int("participants"),
    summary: text("summary"),
    bodyJson: json("body_json").$type<unknown>(),
    bodyHtml: longtext("body_html"),
    outcomes: json("outcomes").$type<string[]>(),
    relatedCertificationIds: json("related_certification_ids").$type<number[]>(),
    coverId: fk("cover_id"),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("trainings_slug_uq").on(t.slug), index("trainings_status_idx").on(t.status, t.publishedAt)],
);

export const trainingModules = mysqlTable(
  "training_modules",
  {
    id: id(),
    trainingId: fk("training_id")
      .notNull()
      .references(() => trainings.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 191 }).notNull(),
    description: text("description"),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("training_modules_training_idx").on(t.trainingId)],
);

export const trainingImages = mysqlTable(
  "training_images",
  {
    id: id(),
    trainingId: fk("training_id")
      .notNull()
      .references(() => trainings.id, { onDelete: "cascade" }),
    mediaId: fk("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    caption: varchar("caption", { length: 255 }),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("training_images_training_idx").on(t.trainingId)],
);

export const courses = mysqlTable(
  "courses",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    trackId: fk("track_id").references(() => categories.id, { onDelete: "set null" }),
    summary: text("summary"),
    bodyJson: json("body_json").$type<unknown>(),
    bodyHtml: longtext("body_html"),
    outline: json("outline").$type<string[]>(),
    durationLabel: varchar("duration_label", { length: 60 }),
    scheduleLabel: varchar("schedule_label", { length: 120 }),
    startDate: date("start_date", { mode: "string" }),
    price: decimal("price", { precision: 12, scale: 2 }),
    currency: mysqlEnum("currency", ["NGN", "USD"]).notNull().default("NGN"),
    seats: int("seats"),
    registrationOpen: boolean("registration_open").notNull().default(true),
    coverId: fk("cover_id"),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("courses_slug_uq").on(t.slug)],
);

export const certifications = mysqlTable(
  "certifications",
  {
    id: id(),
    name: varchar("name", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    issuer: varchar("issuer", { length: 191 }).notNull(),
    issuerLogoId: fk("issuer_logo_id"),
    categoryId: fk("category_id").references(() => categories.id, { onDelete: "set null" }),
    issueDate: date("issue_date", { mode: "string" }),
    expiryDate: date("expiry_date", { mode: "string" }),
    credentialId: varchar("credential_id", { length: 191 }),
    verifyUrl: varchar("verify_url", { length: 500 }),
    fileId: fk("file_id"),
    description: text("description"),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("certifications_slug_uq").on(t.slug)],
);

export const albums = mysqlTable(
  "albums",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    description: text("description"),
    coverId: fk("cover_id"),
    date: date("date", { mode: "string" }),
    categoryId: fk("category_id").references(() => categories.id, { onDelete: "set null" }),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("albums_slug_uq").on(t.slug)],
);

export const testimonials = mysqlTable(
  "testimonials",
  {
    id: id(),
    authorName: varchar("author_name", { length: 191 }).notNull(),
    authorRole: varchar("author_role", { length: 191 }),
    company: varchar("company", { length: 191 }),
    companyLogoId: fk("company_logo_id"),
    authorPhotoId: fk("author_photo_id"),
    rating: tinyint("rating").notNull().default(5),
    serviceTypeId: fk("service_type_id").references(() => categories.id, { onDelete: "set null" }),
    projectId: fk("project_id").references(() => projects.id, { onDelete: "set null" }),
    trainingId: fk("training_id").references(() => trainings.id, { onDelete: "set null" }),
    quote: text("quote").notNull(),
    date: date("date", { mode: "string" }),
    source: mysqlEnum("source", ["direct", "linkedin", "google", "email"]).notNull().default("direct"),
    consent: boolean("consent").notNull().default(false),
    moderation: mysqlEnum("moderation", ["pending", "approved", "rejected"]).notNull().default("pending"),
    ...content(),
  },
  (t) => [index("testimonials_mod_idx").on(t.moderation, t.serviceTypeId)],
);

export const reviewRequests = mysqlTable(
  "review_requests",
  {
    id: id(),
    name: varchar("name", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    projectId: fk("project_id").references(() => projects.id, { onDelete: "set null" }),
    trainingId: fk("training_id").references(() => trainings.id, { onDelete: "set null" }),
    serviceTypeId: fk("service_type_id").references(() => categories.id, { onDelete: "set null" }),
    message: text("message"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: ts("expires_at").notNull(),
    sentAt: ts("sent_at"),
    openedAt: ts("opened_at"),
    usedAt: ts("used_at"),
    testimonialId: fk("testimonial_id").references(() => testimonials.id, { onDelete: "set null" }),
    createdBy: fk("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("review_requests_token_uq").on(t.tokenHash)],
);

export const posts = mysqlTable(
  "posts",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    excerpt: text("excerpt"),
    coverId: fk("cover_id"),
    bodyJson: json("body_json").$type<unknown>(),
    bodyHtml: longtext("body_html"),
    categoryId: fk("category_id").references(() => categories.id, { onDelete: "set null" }),
    authorId: fk("author_id").references(() => users.id, { onDelete: "set null" }),
    readingMinutes: int("reading_minutes").notNull().default(1),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("posts_slug_uq").on(t.slug), index("posts_status_idx").on(t.status, t.publishedAt)],
);

export const services = mysqlTable(
  "services",
  {
    id: id(),
    title: varchar("title", { length: 191 }).notNull(),
    slug: varchar("slug", { length: 191 }).notNull(),
    icon: varchar("icon", { length: 60 }),
    summary: text("summary"),
    bodyJson: json("body_json").$type<unknown>(),
    bodyHtml: longtext("body_html"),
    deliverables: json("deliverables").$type<string[]>(),
    process: json("process").$type<Array<{ title: string; description: string }>>(),
    ctaText: varchar("cta_text", { length: 191 }),
    serviceTypeId: fk("service_type_id").references(() => categories.id, { onDelete: "set null" }),
    projectCategoryIds: json("project_category_ids").$type<number[]>(),
    ...seo(),
    ...content(),
  },
  (t) => [uniqueIndex("services_slug_uq").on(t.slug)],
);

export const serviceFaqs = mysqlTable(
  "service_faqs",
  {
    id: id(),
    serviceId: fk("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    question: varchar("question", { length: 255 }).notNull(),
    answer: text("answer").notNull(),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("service_faqs_service_idx").on(t.serviceId)],
);

export const clients = mysqlTable("clients", {
  id: id(),
  name: varchar("name", { length: 191 }).notNull(),
  logoId: fk("logo_id"),
  url: varchar("url", { length: 500 }),
  note: varchar("note", { length: 191 }),
  ...content(),
});

export const pressItems = mysqlTable("press_items", {
  id: id(),
  title: varchar("title", { length: 191 }).notNull(),
  outlet: varchar("outlet", { length: 191 }),
  kind: mysqlEnum("kind", ["speaking", "press", "podcast", "article"]).notNull().default("speaking"),
  date: date("date", { mode: "string" }),
  url: varchar("url", { length: 500 }),
  imageId: fk("image_id"),
  ...content(),
});

export const faqs = mysqlTable("faqs", {
  id: id(),
  question: varchar("question", { length: 255 }).notNull(),
  answer: text("answer").notNull(),
  categoryId: fk("category_id").references(() => categories.id, { onDelete: "set null" }),
  ...content(),
});

export const cvFiles = mysqlTable("cv_files", {
  id: id(),
  title: varchar("title", { length: 191 }).notNull(),
  mediaId: fk("media_id").references(() => media.id, { onDelete: "set null" }),
  isPrimary: boolean("is_primary").notNull().default(false),
  downloads: int("downloads").notNull().default(0),
  ...content(),
});

