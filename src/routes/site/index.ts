import { siteRouter, h } from "./router.js";
import * as Q from "../../server/public.js";
import { breadcrumbLd, orgLd, personLd } from "../../server/seo.js";
import type { Settings } from "../../server/settings.js";
import type { Img } from "../../server/media.js";


siteRouter.get(
  "/",
  h(async (_req, res) => {
    const settings = res.locals.settings as Settings;
    const [sections, stats, services, projects, trainings, clients, reviews, certs, posts, about] = await Promise.all([
      Q.getHomeSections(),
      Q.getStats(),
      Q.getServices(),
      Q.getProjects(),
      Q.getTrainings(),
      Q.getClients(),
      Q.getTestimonials(),
      Q.getCertifications(),
      Q.getPosts(),
      Q.getAbout(),
    ]);
    const featuredSkills = about.skills.filter((k) => k.showOnHome);
    const ticker = (featuredSkills.length >= 6 ? featuredSkills : about.skills).map((k) => k.name).slice(0, 18);
    const socials = res.locals.socials as Array<{ url: string }>;
    const portrait = (res.locals.brand as { portrait?: Img }).portrait;
    const featuredProjects = (projects.filter((p) => p.featured).length ? projects.filter((p) => p.featured) : projects).slice(0, 6);
    const featuredTrainings = (trainings.filter((t) => t.featured).length ? trainings.filter((t) => t.featured) : trainings).slice(0, 6);
    await res.page("site/home", {
      sections,
      ticker,
      stats,
      services,
      featuredProjects,
      featuredTrainings,
      clients,
      reviews: reviews.filter((r) => r.featured).length >= 3 ? reviews.filter((r) => r.featured) : reviews.slice(0, 9),
      certs,
      posts,
      meta: (res.locals.resolveMeta as (m: object) => unknown)({
        jsonLd: [personLd(settings, socials.map((s) => s.url), portrait), orgLd(), { "@context": "https://schema.org", "@type": "WebSite", name: settings.seo.siteName, url: res.locals.appUrl }],
      }),
    });
  }),
);

import "./pages.js";
import "./forms.js";
import "./custom.js";

export { siteRouter, breadcrumbLd };
