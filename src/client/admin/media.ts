import { $, $$, adminBase, api, csrf, h, markDirty, toast } from "./util.js";

export type MediaItem = { id: number; url: string; thumb: string; name: string; mime: string; alt: string; caption: string; credit: string; isImage: boolean };

/** Uploads files with per-file progress bars (XHR gives upload progress; fetch doesn't). */
export function uploadFiles(files: File[], progressList: HTMLElement | null, extra: Record<string, string> = {}): Promise<MediaItem[]> {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<MediaItem[]>((resolve) => {
          const li = h("li", { class: "flex items-center gap-2" }, h("span", { class: "w-40 truncate", text: file.name }));
          const bar = h("progress", { max: "100", value: "0", class: "h-1.5 flex-1", "aria-label": `Uploading ${file.name}` });
          const status = h("span", { class: "w-24 text-right text-muted", text: "0%" });
          li.append(bar, status);
          progressList?.append(li);
          const fd = new FormData();
          fd.append("files", file);
          for (const [k, v] of Object.entries(extra)) fd.append(k, v);
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${adminBase()}/media/upload`);
          xhr.setRequestHeader("x-csrf-token", csrf());
          xhr.setRequestHeader("Accept", "application/json");
          xhr.upload.onprogress = (e) => {
            if (!e.lengthComputable) return;
            const p = Math.round((e.loaded / e.total) * 100);
            bar.value = p;
            status.textContent = p < 100 ? `${p}%` : "Processing…";
          };
          xhr.onload = () => {
            let data: { items?: MediaItem[]; errors?: string[] } = {};
            try {
              data = JSON.parse(xhr.responseText);
            } catch {
              /* non-JSON response */
            }
            if (data.errors?.length) {
              status.textContent = "Failed";
              status.className = "w-24 text-right text-danger";
              toast(data.errors.join(" "), "error");
            } else {
              status.textContent = "Done";
              setTimeout(() => li.replaceWith(), 1500);
            }
            resolve(data.items ?? []);
          };
          xhr.onerror = () => {
            status.textContent = "Network error";
            resolve([]);
          };
          xhr.send(fd);
        }),
    ),
  ).then((r) => r.flat());
}

let pickerResolve: ((items: MediaItem[]) => void) | null = null;

export function openPicker(opts: { accept: string; multiple: boolean }): Promise<MediaItem[]> {
  const dlg = $<HTMLDialogElement>("#media-picker");
  if (!dlg) return Promise.resolve([]);
  const grid = $("[data-mp-grid]", dlg)!;
  const search = $<HTMLInputElement>("[data-mp-search]", dlg)!;
  const confirmBtn = $<HTMLButtonElement>("[data-mp-confirm]", dlg)!;
  const selLabel = $("[data-mp-selected]", dlg)!;
  const empty = $("[data-mp-empty]", dlg)!;
  const fileInput = $<HTMLInputElement>("[data-mp-file]", dlg)!;
  const type = opts.accept === "pdf" ? "pdf" : opts.accept === "image" ? "image" : "";
  fileInput.accept =
    type === "pdf" ? "application/pdf" : type === "image" ? "image/jpeg,image/png,image/webp,image/gif,image/avif" : "image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf";
  fileInput.multiple = opts.multiple;
  const selected = new Map<number, MediaItem>();
  const updateSel = () => {
    confirmBtn.disabled = selected.size === 0;
    selLabel.textContent = selected.size ? `${selected.size} selected` : "Nothing selected";
  };
  const finish = () => {
    const items = [...selected.values()];
    const r = pickerResolve;
    pickerResolve = null;
    dlg.close();
    r?.(items);
  };
  const tile = (m: MediaItem) => {
    const btn = h(
      "button",
      { type: "button", class: "group relative block aspect-square w-full overflow-hidden rounded-lg border-2 border-transparent bg-surface-2 focus-visible:border-gold", "aria-pressed": "false", title: m.name },
      m.thumb ? h("img", { src: m.thumb, alt: m.alt, class: "size-full object-cover", loading: "lazy" }) : h("span", { class: "grid size-full place-items-center p-2 text-center text-xs text-muted", text: m.name }),
    );
    btn.addEventListener("click", () => {
      if (!opts.multiple) {
        selected.clear();
        for (const b of $$("[aria-pressed='true']", grid)) {
          b.setAttribute("aria-pressed", "false");
          b.classList.remove("!border-gold");
        }
      }
      if (selected.has(m.id)) {
        selected.delete(m.id);
        btn.setAttribute("aria-pressed", "false");
        btn.classList.remove("!border-gold");
      } else {
        selected.set(m.id, m);
        btn.setAttribute("aria-pressed", "true");
        btn.classList.add("!border-gold");
      }
      updateSel();
    });
    btn.addEventListener("dblclick", () => {
      if (!opts.multiple) finish();
    });
    return h("li", {}, btn);
  };
  const load = async () => {
    const r = await api<{ items: MediaItem[] }>(`${adminBase()}/media.json?type=${type}&q=${encodeURIComponent(search.value)}`);
    grid.replaceChildren(...(r.items ?? []).map(tile));
    empty.hidden = (r.items ?? []).length > 0;
  };
  search.oninput = () => void load();
  confirmBtn.onclick = finish;
  $<HTMLButtonElement>("[data-mp-close]", dlg)!.onclick = () => dlg.close();
  dlg.onclose = () => {
    const r = pickerResolve;
    pickerResolve = null;
    r?.([]);
  };
  const handleFiles = async (files: File[]) => {
    const items = await uploadFiles(files, $("[data-mp-progress]", dlg));
    await load();
    for (const it of items) {
      selected.set(it.id, it);
      if (!opts.multiple) break;
    }
    updateSel();
    if (items.length && !opts.multiple) finish();
  };
  fileInput.onchange = () => {
    if (fileInput.files?.length) void handleFiles([...fileInput.files]);
    fileInput.value = "";
  };
  const drop = $("[data-mp-drop]", dlg)!;
  drop.ondragover = (e) => {
    e.preventDefault();
    drop.classList.add("!border-gold");
  };
  drop.ondragleave = () => drop.classList.remove("!border-gold");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("!border-gold");
    if (e.dataTransfer?.files.length) void handleFiles([...e.dataTransfer.files]);
  };
  updateSel();
  void load();
  dlg.showModal();
  search.focus();
  return new Promise((res) => (pickerResolve = res));
}

/** Single image/file fields in the editor. */
export function initMediaFields(root: ParentNode = document): void {
  for (const box of $$("[data-media-field]", root)) {
    if (box.dataset.ready) continue;
    box.dataset.ready = "1";
    const input = $<HTMLInputElement>("[data-media-input]", box)!;
    const thumb = $("[data-media-thumb]", box)!;
    const name = $("[data-media-name]", box)!;
    const choose = $<HTMLButtonElement>("[data-media-choose]", box)!;
    const clear = $<HTMLButtonElement>("[data-media-clear]", box)!;
    choose.addEventListener("click", async () => {
      const [m] = await openPicker({ accept: box.dataset.accept ?? "image", multiple: false });
      if (!m) return;
      input.value = String(m.id);
      thumb.replaceChildren(m.thumb ? h("img", { src: m.thumb, alt: "", class: "size-full object-cover" }) : h("span", { class: "text-xs", text: "PDF" }));
      name.textContent = m.name;
      choose.textContent = "Replace";
      clear.hidden = false;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      markDirty(box);
    });
    clear.addEventListener("click", () => {
      input.value = "";
      thumb.replaceChildren();
      name.textContent = "No file selected";
      choose.textContent = "Choose";
      clear.hidden = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      markDirty(box);
    });
  }
}

/** Standalone drag-and-drop uploader on the media library page. */
export function initUploader(): void {
  const zone = $("[data-uploader]");
  if (!zone) return;
  const input = $<HTMLInputElement>("[data-uploader-input]", zone)!;
  const progress = $("[data-uploader-progress]");
  const run = async (files: File[]) => {
    const items = await uploadFiles(files, progress);
    if (items.length) {
      toast(`${items.length} file(s) uploaded. Add alt text to each image.`, "success");
      setTimeout(() => location.reload(), 800);
    }
  };
  input.addEventListener("change", () => {
    if (input.files?.length) void run([...input.files]);
  });
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("!border-gold");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("!border-gold"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("!border-gold");
    if (e.dataTransfer?.files.length) void run([...e.dataTransfer.files]);
  });
}
