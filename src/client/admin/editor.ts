import Sortable from "sortablejs";
import { $, $$, api, h, markDirty, slugify, toast } from "./util.js";
import { openPicker } from "./media.js";

type Sub = { name: string; label: string; type: string; required?: boolean; placeholder?: string };

// ── Repeaters: list (strings), steps, children ────────────────────────────────────────────────────
function initRepeaters(): void {
  for (const box of $$("[data-repeater]")) {
    const input = $<HTMLInputElement>("[data-repeater-input]", box)!;
    const list = $<HTMLOListElement>("[data-repeater-list]", box)!;
    const schema = JSON.parse($("[data-repeater-schema]", box)!.textContent ?? "{}") as { fields: Sub[]; items: Array<Record<string, string>> };
    const mode = box.dataset.mode;
    const label = box.dataset.itemLabel ?? "item";
    const items = schema.items;
    const sync = () => {
      input.value = JSON.stringify(mode === "list" ? items.map((i) => i.value ?? "") : items);
      markDirty(box);
    };
    const render = () => {
      list.replaceChildren(
        ...items.map((it, idx) => {
          const li = h("li", { class: "flex gap-2 rounded-xl border border-line bg-surface-2/40 p-3", "data-idx": String(idx) });
          const handle = h("button", { type: "button", class: "mt-1 cursor-grab self-start text-muted hover:text-ink", "aria-label": `Drag ${label} ${idx + 1}`, "data-handle": "" }, "⋮⋮");
          const fields = h("div", { class: `grid flex-1 gap-2 ${schema.fields.length > 1 && schema.fields.every((f) => f.type !== "textarea") ? "sm:grid-cols-2" : ""}` });
          for (const f of schema.fields) {
            const id = `${input.name}-${idx}-${f.name}`;
            const el =
              f.type === "textarea"
                ? h("textarea", { id, class: "textarea !min-h-20 text-sm", rows: "2", placeholder: f.placeholder })
                : h("input", { id, class: "input !py-1.5 text-sm", type: f.type === "number" ? "number" : "text", placeholder: f.placeholder ?? f.label });
            (el as HTMLInputElement).value = it[f.name] ?? "";
            el.addEventListener("input", () => {
              it[f.name] = (el as HTMLInputElement).value;
              sync();
            });
            fields.append(h("div", { class: "grid gap-1" }, h("label", { for: id, class: schema.fields.length === 1 ? "sr-only" : "text-xs font-semibold text-muted", text: `${f.label}${schema.fields.length === 1 ? ` ${idx + 1}` : ""}` }), el));
          }
          const del = h("button", { type: "button", class: "self-start rounded-md p-1 text-muted hover:text-danger", "aria-label": `Remove ${label} ${idx + 1}`, text: "✕" });
          del.addEventListener("click", () => {
            items.splice(idx, 1);
            sync();
            render();
          });
          li.append(handle, fields, del);
          return li;
        }),
      );
    };
    $("[data-repeater-add]", box)!.addEventListener("click", () => {
      items.push(Object.fromEntries(schema.fields.map((f) => [f.name, ""])));
      sync();
      render();
      ($$("input,textarea", list).at(-schema.fields.length) as HTMLElement | undefined)?.focus();
    });
    Sortable.create(list, {
      handle: "[data-handle]",
      animation: 150,
      onEnd: (e) => {
        const [moved] = items.splice(e.oldIndex!, 1);
        items.splice(e.newIndex!, 0, moved!);
        sync();
        render();
      },
    });
    render();
  }
}

// ── Gallery / album photos ────────────────────────────────────────────────────────────────────────
type GItem = { mediaId: number; caption: string; alt: string; credit: string; url: string; name: string };
function initGalleries(): void {
  for (const box of $$("[data-gallery]")) {
    const input = $<HTMLInputElement>("[data-gallery-input]", box)!;
    const list = $<HTMLUListElement>("[data-gallery-list]", box)!;
    const album = box.dataset.mode === "albumImages";
    const items = JSON.parse($("[data-gallery-items]", box)!.textContent ?? "[]") as GItem[];
    const sync = () => {
      input.value = JSON.stringify(items.map(({ mediaId, caption, alt, credit }) => ({ mediaId, caption, alt, credit })));
      markDirty(box);
    };
    const render = () => {
      list.replaceChildren(
        ...items.map((it, idx) => {
          const li = h("li", { class: "overflow-hidden rounded-xl border border-line bg-surface" });
          const img = h("div", { class: "relative aspect-[4/3] cursor-grab bg-surface-2", "data-handle": "" }, it.url ? h("img", { src: it.url, alt: "", class: "size-full object-cover" }) : null);
          const del = h("button", { type: "button", class: "absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white", "aria-label": `Remove photo ${idx + 1}`, text: "✕" });
          del.addEventListener("click", () => {
            items.splice(idx, 1);
            sync();
            render();
          });
          img.append(del);
          const fields = h("div", { class: "grid gap-1.5 p-2" });
          const mk = (key: "caption" | "alt" | "credit", ph: string) => {
            const el = h("input", { class: `input !py-1 text-xs ${key === "alt" && album && !it.alt ? "!border-danger" : ""}`, placeholder: ph, "aria-label": `${ph} for photo ${idx + 1}` });
            el.value = it[key];
            el.addEventListener("input", () => {
              it[key] = el.value;
              el.classList.toggle("!border-danger", key === "alt" && album && !el.value);
              sync();
            });
            fields.append(el);
          };
          if (album) mk("alt", "Alt text (required)");
          mk("caption", "Caption");
          if (album) mk("credit", "Photographer credit");
          li.append(img, fields);
          return li;
        }),
      );
    };
    $("[data-gallery-add]", box)!.addEventListener("click", async () => {
      const picked = await openPicker({ accept: "image", multiple: true });
      for (const m of picked) if (!items.some((i) => i.mediaId === m.id)) items.push({ mediaId: m.id, caption: m.caption, alt: m.alt, credit: m.credit, url: m.thumb, name: m.name });
      sync();
      render();
    });
    Sortable.create(list, {
      handle: "[data-handle]",
      animation: 150,
      onEnd: (e) => {
        const [moved] = items.splice(e.oldIndex!, 1);
        items.splice(e.newIndex!, 0, moved!);
        sync();
        render();
      },
    });
    render();
  }
}

// ── Page-builder blocks ───────────────────────────────────────────────────────────────────────────
type BField = { name: string; label: string; type: string; options?: Array<[string, string]>; placeholder?: string; help?: string };
type BDef = { type: string; label: string; icon: string; fields: BField[]; defaults: Record<string, unknown> };
type Block = { type: string; data: Record<string, unknown> };

async function initBlocks(): Promise<void> {
  const box = $("[data-blocks]");
  if (!box) return;
  const defs = JSON.parse($("#block-defs")?.textContent ?? "[]") as BDef[];
  const byType = Object.fromEntries(defs.map((d) => [d.type, d]));
  const input = $<HTMLInputElement>("[data-blocks-input]", box)!;
  const list = $<HTMLOListElement>("[data-blocks-list]", box)!;
  const mediaCache = JSON.parse($("[data-blocks-media]", box)?.textContent ?? "{}") as Record<string, { url: string; name: string }>;
  const blocks = JSON.parse(input.value || "[]") as Block[];
  const { mountRich } = await import("./rich.js");
  const sync = () => {
    input.value = JSON.stringify(blocks);
    markDirty(box);
  };
  const render = () => {
    list.replaceChildren(
      ...blocks.map((b, idx) => {
        const def = byType[b.type];
        const li = h("li", { class: "rounded-xl border border-line bg-surface" });
        const head = h("div", { class: "flex items-center gap-2 border-b border-line px-3 py-2" }, h("button", { type: "button", class: "cursor-grab text-muted", "data-handle": "", "aria-label": `Drag ${def?.label ?? b.type} block` }, "⋮⋮"), h("strong", { class: "text-sm text-ink", text: def?.label ?? b.type }));
        const up = h("button", { type: "button", class: "ml-auto rounded px-1.5 text-muted hover:text-ink", "aria-label": "Move up", text: "↑" });
        const down = h("button", { type: "button", class: "rounded px-1.5 text-muted hover:text-ink", "aria-label": "Move down", text: "↓" });
        const del = h("button", { type: "button", class: "rounded px-1.5 text-muted hover:text-danger", "aria-label": `Remove ${def?.label ?? b.type} block`, text: "✕" });
        up.addEventListener("click", () => {
          if (idx === 0) return;
          [blocks[idx - 1], blocks[idx]] = [blocks[idx]!, blocks[idx - 1]!];
          sync();
          render();
        });
        down.addEventListener("click", () => {
          if (idx === blocks.length - 1) return;
          [blocks[idx + 1], blocks[idx]] = [blocks[idx]!, blocks[idx + 1]!];
          sync();
          render();
        });
        del.addEventListener("click", () => {
          if (!confirm("Remove this block?")) return;
          blocks.splice(idx, 1);
          sync();
          render();
        });
        head.append(up, down, del);
        const body = h("div", { class: "grid gap-3 p-3 sm:grid-cols-2" });
        for (const f of def?.fields ?? []) {
          const id = `blk-${idx}-${f.name}`;
          const wrap = h("div", { class: `grid gap-1 ${["richtext", "textarea", "image"].includes(f.type) ? "sm:col-span-2" : ""}` });
          const lab = h("label", { for: id, class: "text-xs font-semibold text-muted", text: f.label });
          const val = b.data[f.name];
          const set = (v: unknown) => {
            b.data[f.name] = v;
            sync();
          };
          if (f.type === "richtext") {
            const host = h("div", { class: "rounded-[10px] border border-line", id });
            wrap.append(lab, host);
            mountRich(host, { html: String(val ?? "") }, (html) => set(html), f.label);
          } else if (f.type === "select") {
            const sel = h("select", { id, class: "select !py-1.5 text-sm" }, ...(f.options ?? []).map(([v, l]) => h("option", { value: v, text: l, selected: String(val ?? "") === v })));
            sel.addEventListener("change", () => set(sel.value));
            wrap.append(lab, sel);
          } else if (f.type === "boolean") {
            const cb = h("input", { id, type: "checkbox", class: "checkbox" });
            cb.checked = Boolean(val);
            cb.addEventListener("change", () => set(cb.checked));
            wrap.className = "flex items-center gap-2 self-end";
            wrap.append(cb, h("label", { for: id, class: "text-sm", text: f.label }));
          } else if (f.type === "image") {
            const cur = val ? mediaCache[String(val)] : undefined;
            const thumb = h("div", { class: "grid size-16 place-items-center overflow-hidden rounded-lg bg-surface-2" }, cur?.url ? h("img", { src: cur.url, alt: "", class: "size-full object-cover" }) : null);
            const pick = h("button", { type: "button", class: "btn btn-outline btn-xs", id, text: val ? "Replace image" : "Choose image" });
            const clr = h("button", { type: "button", class: "btn btn-ghost btn-xs", text: "Remove", hidden: !val });
            pick.addEventListener("click", async () => {
              const [m] = await openPicker({ accept: "image", multiple: false });
              if (!m) return;
              mediaCache[String(m.id)] = { url: m.thumb, name: m.name };
              set(m.id);
              render();
            });
            clr.addEventListener("click", () => {
              set(null);
              render();
            });
            wrap.append(lab, h("div", { class: "flex items-center gap-3" }, thumb, pick, clr));
          } else {
            const el =
              f.type === "textarea"
                ? h("textarea", { id, class: "textarea !min-h-20 text-sm", rows: "2", placeholder: f.placeholder })
                : h("input", { id, class: "input !py-1.5 text-sm", type: f.type === "number" ? "number" : "text", placeholder: f.placeholder });
            (el as HTMLInputElement).value = val === null || val === undefined ? "" : String(val);
            el.addEventListener("input", () => set(f.type === "number" ? Number((el as HTMLInputElement).value) || null : (el as HTMLInputElement).value));
            wrap.append(lab, el);
          }
          if (f.help) wrap.append(h("p", { class: "help", text: f.help }));
          body.append(wrap);
        }
        if (!def?.fields.length) body.append(h("p", { class: "help sm:col-span-2", text: "This block has no settings — it uses site data." }));
        li.append(head, body);
        return li;
      }),
    );
  };
  const adders = $("[data-blocks-add]", box)!;
  adders.append(h("span", { class: "self-center text-sm text-muted", text: "Add block:" }));
  for (const d of defs) {
    const b = h("button", { type: "button", class: "btn btn-outline btn-xs", text: `+ ${d.label}` });
    b.addEventListener("click", () => {
      blocks.push({ type: d.type, data: structuredClone(d.defaults) });
      sync();
      render();
      list.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    adders.append(b);
  }
  Sortable.create(list, {
    handle: "[data-handle]",
    animation: 150,
    onEnd: (e) => {
      const [moved] = blocks.splice(e.oldIndex!, 1);
      blocks.splice(e.newIndex!, 0, moved!);
      sync();
      render();
    },
  });
  render();
}

// ── Editor form behaviours ────────────────────────────────────────────────────────────────────────
function initForm(): void {
  const form = $<HTMLFormElement>("form[data-editor]");
  if (!form) return;

  // Slug auto-generation
  for (const slug of $$<HTMLInputElement>("[data-slug]", form)) {
    const src = form.elements.namedItem(slug.dataset.slugSource ?? "title") as HTMLInputElement | null;
    slug.addEventListener("input", () => slug.setAttribute("data-touched", ""));
    src?.addEventListener("input", () => {
      if (slug.hasAttribute("data-touched")) return;
      slug.value = slugify(src.value);
    });
    slug.addEventListener("blur", () => {
      slug.value = slug.hasAttribute("data-allow-slash") ? slug.value.split("/").map(slugify).filter(Boolean).join("/") : slugify(slug.value);
    });
  }
  // Status → show publish date
  const status = $<HTMLSelectElement>("[data-status-select]", form);
  const at = $("[data-publish-at]", form);
  status?.addEventListener("change", () => {
    if (at) at.hidden = status.value === "draft";
  });
  // Icon preview
  const iconSel = $<HTMLSelectElement>("[data-icon-select]", form);
  if (iconSel) {
    const tpl = $<HTMLTemplateElement>("[data-icon-templates]", form);
    const prev = $("[data-icon-preview]", form)!;
    iconSel.addEventListener("change", () => {
      const ic = tpl?.content.querySelector(`[data-icon="${CSS.escape(iconSel.value)}"]`);
      prev.innerHTML = ic?.innerHTML ?? "";
    });
  }
  // Checklist filter
  for (const cl of $$("[data-checklist]", form)) {
    const f = $<HTMLInputElement>("[data-checklist-filter]", cl)!;
    f.addEventListener("input", () => {
      const q = f.value.toLowerCase();
      for (const li of $$("li", cl)) li.hidden = !(li.textContent ?? "").toLowerCase().includes(q);
    });
  }
  // Dirty tracking + unsaved-changes guard
  form.addEventListener("input", () => (form.dataset.dirty = "1"));
  form.addEventListener("change", () => (form.dataset.dirty = "1"));
  let submitting = false;
  form.addEventListener("submit", () => (submitting = true));
  addEventListener("beforeunload", (e) => {
    if (form.dataset.dirty === "1" && !submitting) {
      e.preventDefault();
    }
  });
  for (const b of $$("[data-no-guard]", form)) b.addEventListener("click", () => (submitting = true));

  // Autosave drafts every 30 s
  const statusEl = $("[data-autosave-status]", form);
  if (form.dataset.autosave === "1") {
    setInterval(async () => {
      if (form.dataset.dirty !== "1" || submitting) return;
      if (status && status.value !== "draft") return;
      const title = form.elements.namedItem(form.dataset.titleField ?? "title") as HTMLInputElement | null;
      if (title && !title.value.trim()) return;
      const body = new URLSearchParams(new FormData(form) as unknown as Record<string, string>);
      if (statusEl) statusEl.textContent = "Autosaving…";
      const r = await api<{ ok: boolean; id?: number; created?: boolean; editUrl?: string; errors?: Record<string, string> }>(form.action, {
        method: "POST",
        body,
        headers: { "Content-Type": "application/x-www-form-urlencoded", "x-autosave": "1" },
      });
      if (r.ok) {
        form.dataset.dirty = "0";
        if (r.created && r.editUrl) {
          form.action = r.editUrl;
          history.replaceState(null, "", r.editUrl);
        }
        if (statusEl) statusEl.textContent = `Draft autosaved at ${new Date().toLocaleTimeString()}`;
      } else if (statusEl) statusEl.textContent = "Autosave paused — fix the highlighted fields and save.";
    }, 30_000);
  }
  // Keyboard save
  addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  if (location.hash === "#saved") toast("Saved.", "success");
}

export async function initEditor(): Promise<void> {
  if (!$("form[data-editor]")) return;
  initForm();
  initRepeaters();
  initGalleries();
  if ($("[data-richtext]")) {
    const { initRichFields } = await import("./rich.js");
    initRichFields();
  }
  await initBlocks();
}
