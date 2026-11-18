import { Router } from "express";
import { dashboardData } from "../../server/dashboard.js";
import { storageHealth } from "../../lib/storage/index.js";
import { sharpStatus } from "../../server/upload.js";
import { getSettings } from "../../server/settings.js";
import { getSocials } from "../../server/public.js";
import { isPlaceholder } from "../../lib/util.js";
import { ah } from "./mw.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", ah(async (_req, res) => {
  const [data, settings, socials] = await Promise.all([dashboardData(), getSettings(), getSocials()]);
  const contact = data.checklist.find((c) => "key" in c && c.key === "contact");
  if (contact) contact.done = !isPlaceholder(settings.profile.email) && socials.length > 0;
  await res.page("admin/dashboard", { layout: "admin", title: "Dashboard", ...data, storage: storageHealth(), sharp: sharpStatus() });
}));
