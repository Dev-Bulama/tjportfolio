/** Page-builder block types (brief §4.9). Pure data: imported by server and admin client bundle. */

export type BlockField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "richtext" | "url" | "number" | "select" | "image" | "boolean";
  options?: Array<[string, string]>;
  placeholder?: string;
  help?: string;
};

export type BlockType = { type: string; label: string; icon: string; fields: BlockField[]; defaults: Record<string, unknown> };

export const BLOCKS: BlockType[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "panel-top",
    fields: [
      { name: "kicker", label: "Kicker", type: "text" },
      { name: "title", label: "Title", type: "text" },
      { name: "subtitle", label: "Subtitle", type: "textarea" },
      { name: "ctaLabel", label: "Button label", type: "text" },
      { name: "ctaHref", label: "Button link", type: "url", placeholder: "/contact" },
      { name: "imageId", label: "Image", type: "image" },
      { name: "align", label: "Alignment", type: "select", options: [["left", "Left"], ["center", "Center"]] },
    ],
    defaults: { kicker: "", title: "", subtitle: "", align: "left" },
  },
  { type: "richtext", label: "Rich text", icon: "text", fields: [{ name: "html", label: "Content", type: "richtext" }], defaults: { html: "" } },
  {
    type: "image",
    label: "Image",
    icon: "image",
    fields: [
      { name: "imageId", label: "Image", type: "image" },
      { name: "caption", label: "Caption", type: "text" },
      { name: "wide", label: "Full width", type: "boolean" },
    ],
    defaults: { wide: false },
  },
  {
    type: "imageText",
    label: "Image + text",
    icon: "columns-2",
    fields: [
      { name: "imageId", label: "Image", type: "image" },
      { name: "title", label: "Title", type: "text" },
      { name: "html", label: "Text", type: "richtext" },
      { name: "side", label: "Image side", type: "select", options: [["left", "Left"], ["right", "Right"]] },
    ],
    defaults: { side: "left" },
  },
  { type: "gallery", label: "Gallery", icon: "images", fields: [{ name: "albumSlug", label: "Album slug", type: "text", help: "Shows photos from this gallery album." }, { name: "limit", label: "Max photos", type: "number" }], defaults: { limit: 9 } },
  { type: "stats", label: "Stats", icon: "bar-chart-3", fields: [{ name: "title", label: "Title (optional)", type: "text" }], defaults: {} },
  {
    type: "cards",
    label: "Cards",
    icon: "layout-grid",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "source", label: "Content", type: "select", options: [["projects", "Projects"], ["trainings", "Trainings"], ["certifications", "Certifications"], ["testimonials", "Testimonials"], ["posts", "Insights"]] },
      { name: "category", label: "Filter by category slug (optional)", type: "text" },
      { name: "featuredOnly", label: "Featured only", type: "boolean" },
      { name: "limit", label: "Max items", type: "number" },
    ],
    defaults: { source: "projects", limit: 6, featuredOnly: false },
  },
  {
    type: "cta",
    label: "CTA band",
    icon: "megaphone",
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "text", label: "Text", type: "textarea" },
      { name: "label", label: "Button label", type: "text" },
      { name: "href", label: "Button link", type: "url" },
    ],
    defaults: { title: "", text: "", label: "Get in touch", href: "/contact" },
  },
  { type: "faq", label: "FAQ", icon: "circle-help", fields: [{ name: "title", label: "Title", type: "text" }, { name: "category", label: "FAQ category slug (optional)", type: "text" }], defaults: { title: "Frequently asked questions" } },
  {
    type: "embed",
    label: "Embed",
    icon: "square-play",
    fields: [
      { name: "kind", label: "Type", type: "select", options: [["youtube", "YouTube"], ["calendly", "Calendly / Cal.com"], ["map", "Google Maps"]] },
      { name: "url", label: "URL", type: "url" },
      { name: "title", label: "Accessible title", type: "text" },
    ],
    defaults: { kind: "youtube" },
  },
  { type: "contact", label: "Contact form", icon: "mail", fields: [{ name: "title", label: "Title", type: "text" }, { name: "intro", label: "Intro", type: "textarea" }], defaults: { title: "Get in touch" } },
  {
    type: "spacer",
    label: "Spacer / divider",
    icon: "separator-horizontal",
    fields: [
      { name: "size", label: "Size", type: "select", options: [["sm", "Small"], ["md", "Medium"], ["lg", "Large"]] },
      { name: "divider", label: "Show gold rule", type: "boolean" },
    ],
    defaults: { size: "md", divider: true },
  },
];

export const BLOCK_MAP: Record<string, BlockType> = Object.fromEntries(BLOCKS.map((b) => [b.type, b]));

/** Converts YouTube/Vimeo/Maps/Calendly URLs into safe embeddable URLs, or null if not allowed. */
export function embedUrl(kind: string, url: string): string | null {
  try {
    const u = new URL(url);
    if (kind === "youtube") {
      const id = u.hostname.includes("youtu.be") ? u.pathname.slice(1) : (u.searchParams.get("v") ?? u.pathname.split("/").pop() ?? "");
      return /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (kind === "vimeo") {
      const id = u.pathname.split("/").filter(Boolean).pop() ?? "";
      return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (kind === "calendly") return /(^|\.)calendly\.com$|(^|\.)cal\.com$/.test(u.hostname) ? u.toString() : null;
    if (kind === "map") return /(^|\.)google\.[a-z.]+$/.test(u.hostname) && u.pathname.includes("/maps") ? u.toString() : null;
  } catch {
    return null;
  }
  return null;
}
