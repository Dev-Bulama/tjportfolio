import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env, adminBase } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { nonce, permissionsPolicy, securityHeaders } from "./middleware/security.js";
import { csrfGuard, sessionContext } from "./middleware/context.js";
import { pageRenderer } from "./lib/render.js";
import { viewHelpers } from "./lib/view-helpers.js";
import { siteContext, maintenanceGate } from "./routes/site/context.js";
import { siteRouter } from "./routes/site/index.js";
import { apiRouter } from "./routes/api/index.js";
import { adminRouter } from "./routes/admin/index.js";
import { setupRouter } from "./routes/setup.js";
import { mediaRouter } from "./routes/api/media.js";
import { seoRouter } from "./routes/site/seo.js";
import { ROOT } from "./config/paths.js";

export function createApp(): express.Express {
  const app = express();
  const root = ROOT;

  app.set("trust proxy", /^\d+$/.test(env.TRUST_PROXY) ? Number(env.TRUST_PROXY) : env.TRUST_PROXY);
  app.set("view engine", "ejs");
  app.set("views", path.join(root, "views"));
  app.set("view cache", env.NODE_ENV === "production");
  app.disable("x-powered-by");
  Object.assign(app.locals, viewHelpers);

  app.use(nonce);
  app.use(securityHeaders);
  app.use(permissionsPolicy);
  app.use(compression());

  // Static assets: long-cache for fingerprinted bundles and fonts.
  app.use(
    express.static(path.join(root, "public"), {
      index: false,
      maxAge: env.NODE_ENV === "production" ? "365d" : 0,
      immutable: env.NODE_ENV === "production",
      setHeaders: (res, p) => {
        if (p.endsWith(".webmanifest")) res.setHeader("Content-Type", "application/manifest+json");
      },
    }),
  );
  app.use(mediaRouter);

  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(express.json({ limit: "2mb" }));
  app.use(sessionContext);
  app.use(pageRenderer(app));
  app.use(csrfGuard);

  app.use("/api", apiRouter);
  app.use(seoRouter);
  app.use("/setup", setupRouter);
  app.use(adminBase, adminRouter);

  app.use(siteContext);
  app.use(maintenanceGate);
  app.use(siteRouter);

  // 404
  app.use(async (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ ok: false, error: "Not found" });
      return;
    }
    const rm = res.locals.resolveMeta as ((m: object) => unknown) | undefined;
    await res.page("site/error", { status: 404, meta: rm?.({ title: "Page not found", noindex: true }) ?? res.locals.meta }, 404);
  });

  // 500
  app.use(async (err: Error & { status?: number }, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) logger.error({ err, path: req.path }, "request failed");
    if (res.headersSent) return;
    if (req.path.startsWith("/api/") || req.accepts(["html", "json"]) === "json") {
      res.status(status).json({ ok: false, error: status >= 500 ? "Something went wrong." : err.message });
      return;
    }
    try {
      if (!res.locals.settings) await siteContext(req, res, () => {});
      const rm = res.locals.resolveMeta as ((m: object) => unknown) | undefined;
      await res.page("site/error", { status, message: status < 500 ? err.message : undefined, meta: rm?.({ title: status === 403 ? "Not allowed" : "Something went wrong", noindex: true }) }, status);
    } catch (renderErr) {
      // Even the branded error page failed (e.g. database unreachable): log both errors for the host's logs.
      logger.error({ err: renderErr, original: err.message, path: req.path }, "error page could not be rendered");
      res.status(status).type("text").send("Something went wrong. Please try again in a moment.");
    }
  });

  return app;
}
