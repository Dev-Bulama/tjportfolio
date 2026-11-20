import type { SessionRow, SessionUser } from "./lib/auth/session.js";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
      session?: SessionRow;
      /** Token to embed in forms / send as x-csrf-token. */
      csrfToken: string;
      ipHashed: string;
    }
    interface Response {
      page(view: string, data?: Record<string, unknown>, status?: number): Promise<void>;
    }
  }
}
export {};
