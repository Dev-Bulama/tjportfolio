import { $, adminBase, api, h } from "./util.js";

type Item = { label: string; group: string; href: string };

export function initPalette(): void {
  const dlg = $<HTMLDialogElement>("#palette");
  if (!dlg) return;
  const input = $<HTMLInputElement>("#palette-input", dlg)!;
  const list = $<HTMLUListElement>("[data-palette-list]", dlg)!;
  const base: Item[] = JSON.parse($("#palette-data")?.textContent ?? "[]");
  let items: Item[] = base;
  let active = 0;
  let timer: number | undefined;

  const render = () => {
    list.replaceChildren();
    if (!items.length) {
      list.append(h("li", { class: "px-3 py-6 text-center text-sm text-muted", text: "No matches." }));
      return;
    }
    let lastGroup = "";
    items.slice(0, 40).forEach((it, i) => {
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        list.append(h("li", { class: "px-3 pb-1 pt-3 text-[0.68rem] font-semibold uppercase tracking-wider text-muted", role: "presentation", text: it.group }));
      }
      const li = h("li", { id: `pal-${i}`, role: "option", "aria-selected": i === active ? "true" : "false", class: `cursor-pointer rounded-lg px-3 py-2 text-sm ${i === active ? "bg-surface-2 text-ink" : "text-body"}`, text: it.label });
      li.addEventListener("click", () => go(it));
      li.addEventListener("mousemove", () => {
        if (active !== i) {
          active = i;
          render();
        }
      });
      list.append(li);
    });
    input.setAttribute("aria-activedescendant", `pal-${active}`);
    $(`#pal-${active}`, list)?.scrollIntoView({ block: "nearest" });
  };
  const go = (it: Item) => {
    dlg.close();
    location.href = it.href;
  };
  const filter = async () => {
    const q = input.value.trim().toLowerCase();
    const local = base.filter((i) => !q || i.label.toLowerCase().includes(q));
    items = local;
    active = 0;
    render();
    if (q.length >= 2) {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const r = await api<{ items?: Item[] }>(`${adminBase()}/search?q=${encodeURIComponent(q)}`);
        if (input.value.trim().toLowerCase() !== q) return;
        items = [...local, ...(r.items ?? [])];
        render();
      }, 180);
    }
  };
  const openPalette = () => {
    input.value = "";
    items = base;
    active = 0;
    render();
    dlg.showModal();
    input.focus();
  };
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      if (dlg.open) dlg.close();
      else openPalette();
    }
  });
  for (const b of document.querySelectorAll("[data-palette-open]")) b.addEventListener("click", openPalette);
  input.addEventListener("input", filter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      active = Math.min(items.length - 1, active + 1);
      render();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      active = Math.max(0, active - 1);
      render();
      e.preventDefault();
    } else if (e.key === "Enter" && items[active]) {
      go(items[active]!);
    }
  });
  dlg.addEventListener("click", (e) => e.target === dlg && dlg.close());
}
