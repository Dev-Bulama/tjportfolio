import type { Action, Resource } from "../../lib/permissions.js";

export type NavItem = { label: string; href: string; icon: string; perm?: [Action, Resource]; badge?: string };
export type NavGroup = { label: string; items: NavItem[] };

/** Admin navigation (also feeds the ⌘K command palette). Hrefs are relative to ADMIN_PATH. */
export const NAV: NavGroup[] = [
  { label: "", items: [{ label: "Dashboard", href: "/", icon: "layout-dashboard" }] },
  {
    label: "Portfolio",
    items: [
      { label: "Projects", href: "/content/projects", icon: "briefcase", perm: ["view", "content"] },
      { label: "Trainings", href: "/content/trainings", icon: "presentation", perm: ["view", "content"] },
      { label: "Courses", href: "/content/courses", icon: "graduation-cap", perm: ["view", "content"] },
      { label: "Certifications", href: "/content/certifications", icon: "award", perm: ["view", "content"] },
      { label: "Testimonials", href: "/content/testimonials", icon: "quote", perm: ["view", "content"] },
      { label: "Services", href: "/content/services", icon: "layers", perm: ["view", "content"] },
      { label: "Insights", href: "/content/posts", icon: "pen-line", perm: ["view", "content"] },
      { label: "Gallery", href: "/content/albums", icon: "images", perm: ["view", "content"] },
    ],
  },
  {
    label: "Profile",
    items: [
      { label: "Profile & portrait", href: "/settings#profile", icon: "user-round", perm: ["view", "settings"] },
      { label: "Experience", href: "/content/experiences", icon: "milestone", perm: ["view", "content"] },
      { label: "Education", href: "/content/education", icon: "school", perm: ["view", "content"] },
      { label: "Skills", href: "/content/skills", icon: "cpu", perm: ["view", "content"] },
      { label: "Clients & partners", href: "/content/clients", icon: "building-2", perm: ["view", "content"] },
      { label: "Speaking & press", href: "/content/press", icon: "mic", perm: ["view", "content"] },
      { label: "CV files", href: "/content/cvs", icon: "file-text", perm: ["view", "content"] },
      { label: "FAQs", href: "/content/faqs", icon: "circle-help", perm: ["view", "content"] },
    ],
  },
  {
    label: "Inbox",
    items: [
      { label: "Messages", href: "/inbox", icon: "inbox", perm: ["view", "inbox"] },
      { label: "Maintenance tickets", href: "/tickets", icon: "life-buoy", perm: ["view", "inbox"] },
      { label: "Registrations", href: "/registrations", icon: "clipboard-list", perm: ["view", "inbox"] },
      { label: "Review requests", href: "/review-requests", icon: "send", perm: ["view", "inbox"] },
      { label: "Subscribers", href: "/subscribers", icon: "mail", perm: ["view", "inbox"] },
    ],
  },
  {
    label: "Site",
    items: [
      { label: "Pages", href: "/content/pages", icon: "file-stack", perm: ["view", "content"] },
      { label: "Menus", href: "/menus", icon: "list-tree", perm: ["view", "content"] },
      { label: "Homepage", href: "/content/homepage", icon: "house", perm: ["view", "content"] },
      { label: "Media library", href: "/media", icon: "image", perm: ["view", "content"] },
      { label: "Social links", href: "/content/socials", icon: "share-2", perm: ["view", "content"] },
      { label: "Stats", href: "/content/stats", icon: "bar-chart-3", perm: ["view", "content"] },
      { label: "Categories", href: "/content/categories", icon: "tags", perm: ["view", "content"] },
      { label: "Analytics", href: "/analytics", icon: "line-chart", perm: ["view", "analytics"] },
    ],
  },
  {
    label: "Settings",
    items: [
      { label: "Site settings", href: "/settings", icon: "settings", perm: ["view", "settings"] },
      { label: "Users & roles", href: "/users", icon: "users", perm: ["view", "users"] },
      { label: "Audit log", href: "/audit", icon: "scroll-text", perm: ["view", "audit"] },
      { label: "Backups", href: "/backups", icon: "archive", perm: ["manage", "system"] },
      { label: "System", href: "/system", icon: "server", perm: ["manage", "system"] },
    ],
  },
];
