import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "blockquote",
  "code", "pre", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td", "span", "mark", "sup", "sub",
];

/** Sanitizes rich-text HTML (on save and again at render — brief §9). */
export function sanitizeRich(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height", "loading"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      code: ["class"],
      span: ["class"],
      h2: ["id"],
      h3: ["id"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["http", "https"] },
    allowProtocolRelative: false,
    allowedClasses: { code: [/^language-[\w-]+$/], span: ["highlight"] },
    transformTags: {
      a: (tagName, attribs) => {
        const external = /^https?:\/\//i.test(attribs.href ?? "");
        return {
          tagName,
          attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } : attribs,
        };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
  });
}

/** Plain text only (for emails, notes and single-line inputs). */
export function sanitizePlain(s: string | null | undefined): string {
  // Strip tags, then decode the entities sanitize-html introduces: values are escaped again at render.
  return sanitizeHtml(s ?? "", { allowedTags: [], allowedAttributes: {} })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Removes block elements that still contain an editable placeholder like [[Describe…]], then drops
 * headings left without content beneath them — so half-finished case studies never leak placeholders.
 */
export function stripPlaceholders(html: string): string {
  let out = html.replace(/<(p|li|h2|h3|h4|blockquote)(\s[^>]*)?>(?:(?!<\/\1>)[\s\S])*?\[\[[^\]]*\]\](?:(?!<\/\1>)[\s\S])*?<\/\1>/g, "");
  out = out.replace(/<ul>\s*<\/ul>|<ol>\s*<\/ol>/g, "");
  // heading directly followed by another heading of same/higher level, or by the end
  for (let i = 0; i < 3; i++) out = out.replace(/<h([23])(\s[^>]*)?>(?:(?!<\/h\1>)[\s\S])*<\/h\1>\s*(?=<h[23][\s>]|$)/g, "");
  return out.trim();
}
