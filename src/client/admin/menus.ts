import Sortable from "sortablejs";
import { $, $$, h, markDirty } from "./util.js";

type Item = { label: string; href: string; newTab: boolean; visible: boolean; child: boolean };

/** Menu manager: reorder by drag, indent to nest one level under the previous item. */
export function initMenus(): void {
  for (const box of $$("[data-menu-builder]")) {
    const input = $<HTMLInputElement>("[data-menu-input]", box)!;
    const list = $<HTMLOListElement>("[data-menu-list]", box)!;
    const items = JSON.parse(input.value || "[]") as Item[];
    const sync = () => {
      if (items[0]) items[0].child = false;
      input.value = JSON.stringify(items);
      markDirty(box);
    };
    const render = () => {
      list.replaceChildren(
        ...items.map((it, idx) => {
          const li = h("li", { class: `flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2 ${it.child ? "ml-8" : ""}` });
          const handle = h("button", { type: "button", class: "cursor-grab px-1 text-muted", "data-handle": "", "aria-label": `Drag ${it.label || "item"}` }, "⋮⋮");
          const label = h("input", { class: "input !w-40 !py-1.5 text-sm", placeholder: "Label", "aria-label": `Label for item ${idx + 1}` });
          label.value = it.label;
          label.addEventListener("input", () => {
            it.label = label.value;
            sync();
          });
          const href = h("input", { class: "input !w-56 flex-1 !py-1.5 font-mono text-xs", placeholder: "/about or https://…", "aria-label": `Link for item ${idx + 1}` });
          href.value = it.href;
          href.addEventListener("input", () => {
            it.href = href.value;
            sync();
          });
          const mkCheck = (key: "newTab" | "visible", text: string) => {
            const cb = h("input", { type: "checkbox", class: "checkbox" });
            cb.checked = it[key];
            cb.addEventListener("change", () => {
              it[key] = cb.checked;
              sync();
            });
            return h("label", { class: "flex items-center gap-1 text-xs" }, cb, text);
          };
          const indent = h("button", { type: "button", class: "btn btn-ghost btn-xs", text: it.child ? "← Outdent" : "Indent →", disabled: idx === 0 });
          indent.addEventListener("click", () => {
            it.child = !it.child;
            sync();
            render();
          });
          const del = h("button", { type: "button", class: "btn btn-ghost btn-xs text-danger", "aria-label": `Delete ${it.label}`, text: "Delete" });
          del.addEventListener("click", () => {
            items.splice(idx, 1);
            sync();
            render();
          });
          li.append(handle, label, href, mkCheck("visible", "Visible"), mkCheck("newTab", "New tab"), indent, del);
          return li;
        }),
      );
    };
    $("[data-menu-add]", box)?.addEventListener("click", () => {
      items.push({ label: "", href: "/", newTab: false, visible: true, child: false });
      sync();
      render();
    });
    for (const quick of $$<HTMLButtonElement>("[data-menu-quick]", box)) {
      quick.addEventListener("click", () => {
        items.push({ label: quick.dataset.label ?? "", href: quick.dataset.menuQuick ?? "/", newTab: false, visible: true, child: false });
        sync();
        render();
      });
    }
    Sortable.create(list, {
      handle: "[data-handle]",
      animation: 150,
      onEnd: (e) => {
        const [m] = items.splice(e.oldIndex!, 1);
        items.splice(e.newIndex!, 0, m!);
        sync();
        render();
      },
    });
    render();
  }
}
