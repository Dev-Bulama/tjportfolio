import type { Role } from "../db/schema/auth.js";

export type Action = "view" | "create" | "update" | "delete" | "publish" | "manage";
/**
 * Resource groups:
 *  content  – every content module, media, menus, pages
 *  inbox    – messages, tickets, registrations, subscribers, review requests
 *  settings – profile & site settings, integrations
 *  analytics
 *  users, security, system (backups, migrations, audit)
 */
export type Resource = "content" | "inbox" | "settings" | "analytics" | "users" | "security" | "system" | "audit";

const MATRIX: Record<Role, Partial<Record<Resource, Action[] | "*">>> = {
  owner: { content: "*", inbox: "*", settings: "*", analytics: "*", users: "*", security: "*", system: "*", audit: "*" },
  admin: { content: "*", inbox: "*", settings: "*", analytics: ["view"], audit: ["view"] },
  editor: { content: ["view", "create", "update", "delete", "publish"], analytics: ["view"] },
  viewer: { content: ["view"], inbox: ["view"], analytics: ["view"], settings: ["view"] },
};

export function can(user: { role: Role } | null | undefined, action: Action, resource: Resource): boolean {
  if (!user) return false;
  const rule = MATRIX[user.role]?.[resource];
  if (!rule) return false;
  return rule === "*" || rule.includes(action);
}

export class ForbiddenError extends Error {
  status = 403;
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}
