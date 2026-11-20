import Sortable from "sortablejs";
import { $, $$, api, toast } from "./util.js";

export function initLists(): void {
  const form = $<HTMLFormElement>("[data-bulk-form]");
  if (form) {
    const bar = $("[data-bulk-bar]", form);
    const count = $("[data-bulk-count]", form);
    const checks = $$<HTMLInputElement>("[data-row-check]", form);
    const all = $<HTMLInputElement>("[data-select-all]", form);
    const update = () => {
      const n = checks.filter((c) => c.checked).length;
      if (bar) bar.hidden = n === 0;
      if (count) count.textContent = `${n} selected`;
      if (all) {
        all.checked = n > 0 && n === checks.length;
        all.indeterminate = n > 0 && n < checks.length;
      }
    };
    all?.addEventListener("change", () => {
      checks.forEach((c) => (c.checked = all.checked));
      update();
    });
    checks.forEach((c) => c.addEventListener("change", update));
    // Single-row actions inside the bulk form (e.g. restore one item from trash)
    for (const b of $$<HTMLButtonElement>("[data-only]", form)) {
      b.addEventListener("click", () => {
        checks.forEach((c) => (c.checked = c.value === b.dataset.only));
      });
    }
  }

  const tbody = $<HTMLElement>("[data-sortable]");
  if (tbody) {
    Sortable.create(tbody, {
      handle: "[data-drag-handle]",
      animation: 150,
      ghostClass: "opacity-40",
      onEnd: async () => {
        const ids = $$<HTMLTableRowElement>("tr[data-id]", tbody).map((r) => r.dataset.id);
        const body = new URLSearchParams();
        ids.forEach((id) => id && body.append("ids", id));
        const r = await api<{ ok: boolean }>(tbody.dataset.sortable!, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        toast(r.ok ? "Order saved." : "Couldn't save the new order.", r.ok ? "success" : "error");
      },
    });
    // Keyboard reordering: Alt+ArrowUp/Down on a drag handle
    tbody.addEventListener("keydown", (e) => {
      const handle = (e.target as Element).closest("[data-drag-handle]");
      if (!handle || !e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
      const row = handle.closest("tr")!;
      const sib = e.key === "ArrowUp" ? row.previousElementSibling : row.nextElementSibling;
      if (!sib) return;
      if (e.key === "ArrowUp") sib.before(row);
      else sib.after(row);
      (handle as HTMLElement).focus();
      e.preventDefault();
      const ids = $$<HTMLTableRowElement>("tr[data-id]", tbody).map((r) => r.dataset.id);
      const body = new URLSearchParams();
      ids.forEach((id) => id && body.append("ids", id));
      void api(tbody.dataset.sortable!, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } }).then(() => toast("Order saved.", "success"));
    });
  }
}
