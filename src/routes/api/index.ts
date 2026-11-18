import { Router } from "express";
import { dbHealth } from "../../db/index.js";
import { storageHealth } from "../../lib/storage/index.js";

export const apiRouter = Router();

apiRouter.get("/health", async (_req, res) => {
  const db = await dbHealth();
  const storage = storageHealth();
  res.setHeader("Cache-Control", "no-store");
  res.status(db.ok ? 200 : 503).json({
    ok: db.ok,
    db: db.ok ? "up" : "down",
    dbVersion: db.version,
    ...(db.ok ? {} : { dbError: db.error }),
    storage: storage ? { driver: storage.driver, ok: storage.ok } : undefined,
    uptime: Math.round(process.uptime()),
    node: process.version,
  });
});
