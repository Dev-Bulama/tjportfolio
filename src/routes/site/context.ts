import type { NextFunction, Request, Response } from "express";
import { getSettings } from "../../server/settings.js";
import { getMenu, getSocials } from "../../server/public.js";
import { mediaMap } from "../../server/media.js";
import { resolveMeta } from "../../server/seo.js";
import { pub, whatsappLink } from "../../lib/util.js";
import { logger } from "../../lib/logger.js";

/** Loads everything the public layout needs (cached), and a meta resolver. */
export async function siteContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [settings, header, footer, legal, socials] = await Promise.all([
      getSettings(),
      getMenu("header"),
      getMenu("footer"),
      getMenu("legal"),
      getSocials(),
    ]);
    const brandMedia = await mediaMap([settings.branding.logoLightId, settings.branding.logoDarkId, settings.branding.faviconId, settings.profile.portraitId]);
    res.locals.settings = settings;
    res.locals.profile = settings.profile;
    res.locals.menus = { header, footer, legal };
    res.locals.socials = socials;
    res.locals.brand = {
      logoLight: settings.branding.logoLightId ? brandMedia.get(settings.branding.logoLightId) : undefined,
      logoDark: settings.branding.logoDarkId ? brandMedia.get(settings.branding.logoDarkId) : undefined,
      favicon: settings.branding.faviconId ? brandMedia.get(settings.branding.faviconId) : undefined,
      portrait: settings.profile.portraitId ? brandMedia.get(settings.profile.portraitId) : undefined,
    };
    res.locals.whatsapp = whatsappLink(settings.profile.whatsapp, settings.integrations.whatsappMessage);
    res.locals.contactEmail = pub(settings.profile.email);
    res.locals.accent = /^#[0-9a-f]{6}$/i.test(settings.branding.accentOverride) ? settings.branding.accentOverride : "";
    res.locals.meta = resolveMeta(settings, { path: req.path });
    res.locals.resolveMeta = (m: Parameters<typeof resolveMeta>[1], img?: Parameters<typeof resolveMeta>[2]) =>
      resolveMeta(settings, { path: req.path, ...m }, img);
    res.locals.isActive = (href: string) => (href === "/" ? req.path === "/" : req.path === href || req.path.startsWith(`${href}/`));
    next();
  } catch (e) {
    logger.error({ err: (e as Error).message }, "site context failed");
    next(e);
  }
}

export async function maintenanceGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const s = res.locals.settings as Awaited<ReturnType<typeof getSettings>> | undefined;
  if (!s?.site.maintenanceMode || req.user) return next();
  res.setHeader("Retry-After", "3600");
  await res.page("site/maintenance", { layout: false, message: s.site.maintenanceMessage }, 503);
}
