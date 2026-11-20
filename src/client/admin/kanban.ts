import Sortable from "sortablejs";
import { $$, api, toast } from "./util.js";

/** Ticket board: drag a card to another column to change its status. */
export function initKanban(): void {
  for (const col of $$("[data-kanban-col]")) {
    Sortable.create(col, {
      group: "tickets",
      animation: 150,
      ghostClass: "opacity-40",
      onAdd: async (e) => {
        const card = e.item as HTMLElement;
        const status = col.dataset.kanbanCol!;
        const body = new URLSearchParams({ status });
        const r = await api<{ ok: boolean; error?: string }>(card.dataset.statusUrl!, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        toast(r.ok ? `Moved to ${status.replace(/_/g, " ")}.` : (r.error ?? "Couldn't update the ticket."), r.ok ? "success" : "error");
        for (const c of $$("[data-kanban-count]")) {
          const list = document.querySelector(`[data-kanban-col="${c.dataset.kanbanCount}"]`);
          c.textContent = String(list?.children.length ?? 0);
        }
      },
    });
  }
}
