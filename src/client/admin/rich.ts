import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { h } from "./util.js";
import { openPicker } from "./media.js";

type Btn = { label: string; icon: string; run: (e: Editor) => void; active?: (e: Editor) => boolean };

const svg = (d: string) => `<svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS: Record<string, string> = {
  bold: svg('<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>'),
  italic: svg('<line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/>'),
  h2: '<span class="text-xs font-bold">H2</span>',
  h3: '<span class="text-xs font-bold">H3</span>',
  ul: svg('<path d="M3 12h.01M3 18h.01M3 6h.01M8 12h13M8 18h13M8 6h13"/>'),
  ol: svg('<path d="M10 12h11M10 18h11M10 6h11M4 10h2M4 6h1v4M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>'),
  quote: svg('<path d="M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2zM5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z"/>'),
  code: svg('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>'),
  link: svg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  image: svg('<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>'),
  hr: svg('<line x1="3" x2="21" y1="12" y2="12"/>'),
  undo: svg('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
  redo: svg('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>'),
};

const BUTTONS: Array<Btn | "|"> = [
  { label: "Bold", icon: "bold", run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive("bold") },
  { label: "Italic", icon: "italic", run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive("italic") },
  "|",
  { label: "Heading 2", icon: "h2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "Heading 3", icon: "h3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive("heading", { level: 3 }) },
  { label: "Bullet list", icon: "ul", run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive("bulletList") },
  { label: "Numbered list", icon: "ol", run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive("orderedList") },
  { label: "Quote", icon: "quote", run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive("blockquote") },
  { label: "Code block", icon: "code", run: (e) => e.chain().focus().toggleCodeBlock().run(), active: (e) => e.isActive("codeBlock") },
  "|",
  {
    label: "Link",
    icon: "link",
    run: (e) => {
      const prev = e.getAttributes("link").href as string | undefined;
      const url = prompt("Link URL (leave empty to remove)", prev ?? "https://");
      if (url === null) return;
      if (url === "") e.chain().focus().extendMarkRange("link").unsetLink().run();
      else if (/^(https?:|mailto:|tel:|\/)/i.test(url)) e.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    },
    active: (e) => e.isActive("link"),
  },
  {
    label: "Image",
    icon: "image",
    run: async (e) => {
      const [m] = await openPicker({ accept: "image", multiple: false });
      if (!m) return;
      if (!m.alt) {
        const alt = prompt("Alt text for this image (required for accessibility)") ?? "";
        if (!alt) return;
        m.alt = alt;
      }
      e.chain().focus().setImage({ src: m.url, alt: m.alt }).run();
    },
  },
  { label: "Divider", icon: "hr", run: (e) => e.chain().focus().setHorizontalRule().run() },
  "|",
  { label: "Undo", icon: "undo", run: (e) => e.chain().focus().undo().run() },
  { label: "Redo", icon: "redo", run: (e) => e.chain().focus().redo().run() },
];

/** Mounts a Tiptap editor with a toolbar. Calls onChange(html, json) on every update. */
export function mountRich(host: HTMLElement, initial: { html: string; json?: unknown }, onChange: (html: string, json: unknown) => void, label = "Rich text editor"): Editor {
  const toolbar = h("div", { class: "flex flex-wrap items-center gap-0.5 border-b border-line p-1.5", role: "toolbar", "aria-label": "Formatting" });
  const area = h("div", { class: "prose max-w-none px-4 py-3" });
  host.append(toolbar, area);
  const editor = new Editor({
    element: area,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
      Image,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: (initial.json as object | undefined) ?? initial.html ?? "",
    editorProps: { attributes: { class: "min-h-48 outline-none", "aria-label": label, role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getJSON()),
  });
  const btnEls: Array<[HTMLButtonElement, Btn]> = [];
  for (const b of BUTTONS) {
    if (b === "|") {
      toolbar.append(h("span", { class: "mx-1 h-5 w-px bg-line", "aria-hidden": "true" }));
      continue;
    }
    const el = h("button", { type: "button", class: "grid size-8 place-items-center rounded-md text-body hover:bg-surface-2 aria-pressed:bg-surface-2 aria-pressed:text-ink", title: b.label, "aria-label": b.label });
    el.innerHTML = ICONS[b.icon] ?? b.label;
    el.addEventListener("click", () => void b.run(editor));
    toolbar.append(el);
    btnEls.push([el, b]);
  }
  const refresh = () => btnEls.forEach(([el, b]) => b.active && el.setAttribute("aria-pressed", String(b.active(editor))));
  editor.on("selectionUpdate", refresh);
  editor.on("transaction", refresh);
  return editor;
}

export function initRichFields(root: ParentNode = document): void {
  for (const box of root.querySelectorAll<HTMLElement>("[data-richtext]")) {
    if (box.dataset.ready) continue;
    box.dataset.ready = "1";
    const ta = box.querySelector<HTMLTextAreaElement>("[data-richtext-html]")!;
    const js = box.querySelector<HTMLInputElement>("[data-richtext-json]")!;
    let json: unknown;
    try {
      json = js.value ? JSON.parse(js.value) : undefined;
    } catch {
      json = undefined;
    }
    ta.hidden = true;
    const label = document.querySelector(`label[for="${ta.id}"]`)?.textContent?.trim();
    mountRich(
      box,
      { html: ta.value, json },
      (html, j) => {
        ta.value = html;
        js.value = JSON.stringify(j);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      },
      label,
    );
  }
}
