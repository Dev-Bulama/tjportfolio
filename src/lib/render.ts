import type { Application, NextFunction, Request, Response } from "express";

function renderAsync(app: Application, view: string, locals: Record<string, unknown>): Promise<string> {
  return new Promise((resolve, reject) => {
    app.render(view, locals, (err, html) => (err ? reject(err) : resolve(html)));
  });
}

/** Adds res.page(view, data): renders the view, then wraps it in layouts/<layout>.ejs (default "site"). */
export function pageRenderer(app: Application) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.page = async (view, data = {}, status = 200) => {
      const locals = { ...res.locals, ...data };
      const body = await renderAsync(app, view, locals);
      const layout = (data.layout as string | false | undefined) ?? "site";
      const html = layout === false ? body : await renderAsync(app, `layouts/${layout}`, { ...locals, body });
      res.status(status).type("html").send(html);
    };
    next();
  };
}
