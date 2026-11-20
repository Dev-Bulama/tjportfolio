import { appUrl } from "../config/env.js";
import type { Settings } from "./settings.js";
import { pub, truncate } from "../lib/util.js";
import { mediaUrl, type Img } from "./media.js";

export type Meta = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  type?: "website" | "article" | "profile";
  noindex?: boolean;
  publishedTime?: string;
  jsonLd?: unknown[];
};

export function abs(p: string): string {
  return /^https?:\/\//.test(p) ? p : `${appUrl}${p.startsWith("/") ? "" : "/"}${p}`;
}

/** Resolves page meta with sensible defaults from SEO settings. */
export function resolveMeta(s: Settings, m: Meta = {}, ogImage?: Img | null) {
  const title = m.title ? s.seo.titleTemplate.replace("%s", m.title) : s.seo.defaultTitle;
  const description = truncate(m.description || s.seo.defaultDescription, 300);
  const image = ogImage ? abs(mediaUrl(ogImage, 1280)) : m.image ? abs(m.image) : abs(`/og/page.png?title=${encodeURIComponent(m.title ?? s.profile.fullName)}`);
  return {
    title,
    description,
    canonical: abs(m.path ?? "/"),
    image,
    imageAlt: m.imageAlt ?? m.title ?? s.profile.fullName,
    type: m.type ?? "website",
    noindex: m.noindex ?? false,
    publishedTime: m.publishedTime,
    siteName: s.seo.siteName,
    twitter: pub(s.seo.twitterHandle),
    gsc: pub(s.seo.gscVerification),
    jsonLd: m.jsonLd ?? [],
  };
}

export function personLd(s: Settings, sameAs: string[], portrait?: Img | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${appUrl}/#person`,
    name: s.profile.fullName,
    alternateName: s.profile.displayName,
    jobTitle: s.profile.headline,
    description: s.profile.shortBio,
    url: appUrl,
    ...(portrait ? { image: abs(mediaUrl(portrait, 960)) } : {}),
    address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG" },
    ...(pub(s.profile.email) ? { email: `mailto:${s.profile.email}` } : {}),
    worksFor: { "@id": `${appUrl}/#skillscore` },
    sameAs,
  };
}

export function orgLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${appUrl}/#skillscore`,
    name: "Skillscore IT Solutions & Training",
    description: "Lagos-based technology training and software development company.",
    address: { "@type": "PostalAddress", addressLocality: "Lagos", addressCountry: "NG" },
    founder: { "@id": `${appUrl}/#person` },
  };
}

export function breadcrumbLd(items: Array<[string, string]>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
  };
}
