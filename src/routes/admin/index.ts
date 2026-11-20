import { Router } from "express";
import { authRouter } from "./auth.js";
import { accountRouter } from "./account.js";
import { contentRouter } from "./content.js";
import { mediaAdminRouter } from "./media.js";
import { dashboardRouter } from "./dashboard.js";
import { inboxRouter } from "./inbox.js";
import { siteAdminRouter } from "./site.js";
import { adminContext } from "./context.js";
import { readFlash, requireAuth } from "./mw.js";

export const adminRouter = Router();

adminRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});
adminRouter.use(readFlash);
adminRouter.use(authRouter); // login, 2fa, forgot, reset, logout — no session required
adminRouter.use(requireAuth);
adminRouter.use(adminContext);
adminRouter.use(dashboardRouter);
adminRouter.use(accountRouter);
adminRouter.use(contentRouter);
adminRouter.use(mediaAdminRouter);
adminRouter.use(inboxRouter);
adminRouter.use(siteAdminRouter);
