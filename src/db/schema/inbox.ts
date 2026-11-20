import { boolean, index, int, json, mysqlEnum, mysqlTable, text, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { fk, id, timestamps, ts } from "./_helpers.js";
import { users } from "./auth.js";
import { courses, projects } from "./content.js";
import { media } from "./media.js";

export const MESSAGE_STATUS = ["new", "read", "replied", "archived", "spam"] as const;
export const messages = mysqlTable(
  "messages",
  {
    id: id(),
    name: varchar("name", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    company: varchar("company", { length: 191 }),
    inquiryType: varchar("inquiry_type", { length: 60 }).notNull(),
    budget: varchar("budget", { length: 60 }),
    timeline: varchar("timeline", { length: 60 }),
    message: text("message").notNull(),
    attachmentId: fk("attachment_id").references(() => media.id, { onDelete: "set null" }),
    status: mysqlEnum("status", MESSAGE_STATUS).notNull().default("new"),
    page: varchar("page", { length: 255 }),
    referrer: varchar("referrer", { length: 255 }),
    country: varchar("country", { length: 8 }),
    ipHash: varchar("ip_hash", { length: 64 }),
    notes: text("notes"),
    ...timestamps,
  },
  (t) => [index("messages_status_idx").on(t.status, t.createdAt)],
);

export const messageReplies = mysqlTable(
  "message_replies",
  {
    id: id(),
    messageId: fk("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    userId: fk("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    isNote: boolean("is_note").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("message_replies_msg_idx").on(t.messageId)],
);

export const TICKET_STATUS = ["new", "acknowledged", "in_progress", "awaiting_client", "resolved", "closed"] as const;
export const TICKET_PRIORITY = ["low", "normal", "high", "critical"] as const;
export const ISSUE_TYPES = ["bug", "downtime", "content_update", "feature_request", "security", "performance"] as const;

export const maintenanceTickets = mysqlTable(
  "maintenance_tickets",
  {
    id: id(),
    ticketNo: varchar("ticket_no", { length: 32 }).notNull(),
    clientName: varchar("client_name", { length: 191 }).notNull(),
    company: varchar("company", { length: 191 }),
    email: varchar("email", { length: 191 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    projectId: fk("project_id").references(() => projects.id, { onDelete: "set null" }),
    projectOther: varchar("project_other", { length: 191 }),
    issueType: mysqlEnum("issue_type", ISSUE_TYPES).notNull(),
    priority: mysqlEnum("priority", TICKET_PRIORITY).notNull().default("normal"),
    description: text("description").notNull(),
    affectedUrl: varchar("affected_url", { length: 500 }),
    contactMethod: mysqlEnum("contact_method", ["email", "phone", "whatsapp"]).notNull().default("email"),
    status: mysqlEnum("status", TICKET_STATUS).notNull().default("new"),
    dueAt: ts("due_at"),
    resolvedAt: ts("resolved_at"),
    notes: text("notes"),
    ipHash: varchar("ip_hash", { length: 64 }),
    ...timestamps,
  },
  (t) => [uniqueIndex("tickets_no_uq").on(t.ticketNo), index("tickets_status_idx").on(t.status, t.priority)],
);

export const ticketUpdates = mysqlTable(
  "ticket_updates",
  {
    id: id(),
    ticketId: fk("ticket_id")
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: "cascade" }),
    userId: fk("user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body"),
    isPublic: boolean("is_public").notNull().default(false),
    statusFrom: varchar("status_from", { length: 20 }),
    statusTo: varchar("status_to", { length: 20 }),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("ticket_updates_ticket_idx").on(t.ticketId)],
);

export const ticketAttachments = mysqlTable(
  "ticket_attachments",
  {
    id: id(),
    ticketId: fk("ticket_id")
      .notNull()
      .references(() => maintenanceTickets.id, { onDelete: "cascade" }),
    mediaId: fk("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
  },
  (t) => [index("ticket_attachments_ticket_idx").on(t.ticketId)],
);

export const subscribers = mysqlTable(
  "subscribers",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    name: varchar("name", { length: 191 }),
    status: mysqlEnum("status", ["pending", "confirmed", "unsubscribed"]).notNull().default("pending"),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    confirmedAt: ts("confirmed_at"),
    unsubscribedAt: ts("unsubscribed_at"),
    source: varchar("source", { length: 60 }),
    ...timestamps,
  },
  (t) => [uniqueIndex("subscribers_email_uq").on(t.email), index("subscribers_token_idx").on(t.tokenHash)],
);

export const courseRegistrations = mysqlTable(
  "course_registrations",
  {
    id: id(),
    courseId: fk("course_id").references(() => courses.id, { onDelete: "set null" }),
    kind: mysqlEnum("kind", ["registration", "training_request"]).notNull().default("registration"),
    subject: varchar("subject", { length: 191 }),
    name: varchar("name", { length: 191 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    company: varchar("company", { length: 191 }),
    seats: int("seats").notNull().default(1),
    message: text("message"),
    status: mysqlEnum("status", ["new", "contacted", "confirmed", "cancelled"]).notNull().default("new"),
    notes: text("notes"),
    meta: json("meta").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [index("registrations_course_idx").on(t.courseId, t.status)],
);
