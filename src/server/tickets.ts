import { and, desc, eq, like } from "drizzle-orm";
import { db } from "../db/index.js";
import { maintenanceTickets } from "../db/schema/index.js";
import { parseTicketNumber, ticketNumber } from "../lib/util.js";

type NewTicket = Omit<typeof maintenanceTickets.$inferInsert, "ticketNo">;

/** Inserts a ticket with the next number for the year (TJ-MR-2026-0042). Retries on the rare race. */
export async function createTicket(values: NewTicket): Promise<{ id: number; ticketNo: string }> {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const last = (
      await db
        .select({ no: maintenanceTickets.ticketNo })
        .from(maintenanceTickets)
        .where(like(maintenanceTickets.ticketNo, `TJ-MR-${year}-%`))
        .orderBy(desc(maintenanceTickets.id))
        .limit(1)
    )[0];
    const seq = (last ? (parseTicketNumber(last.no)?.seq ?? 0) : 0) + 1 + attempt;
    const ticketNo = ticketNumber(year, seq);
    try {
      const [r] = await db.insert(maintenanceTickets).values({ ...values, ticketNo });
      return { id: r.insertId, ticketNo };
    } catch (e) {
      if ((e as { code?: string }).code !== "ER_DUP_ENTRY") throw e;
    }
  }
  throw new Error("Could not allocate a ticket number");
}

export async function findTicket(ticketNo: string, email: string) {
  return (
    await db
      .select()
      .from(maintenanceTickets)
      .where(and(eq(maintenanceTickets.ticketNo, ticketNo.trim().toUpperCase()), eq(maintenanceTickets.email, email.trim().toLowerCase())))
      .limit(1)
  )[0];
}

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In progress",
  awaiting_client: "Awaiting your reply",
  resolved: "Resolved",
  closed: "Closed",
};
export const ISSUE_LABEL: Record<string, string> = {
  bug: "Bug / error",
  downtime: "Site or app down",
  content_update: "Content update",
  feature_request: "Feature request",
  security: "Security concern",
  performance: "Performance",
};
