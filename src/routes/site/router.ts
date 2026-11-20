import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";

export const siteRouter = Router();

/** Wrap async handlers so rejections reach the error middleware. */
export const h =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
