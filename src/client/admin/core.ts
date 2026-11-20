import { $, $$, toast } from "./util.js";

export function initCore(): void {
  // Theme
  for (const btn of $$("[data-theme-toggle]")) {
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* ignore */
      }
    });
  }
  // Sidebar (mobile slide-over + desktop collapse)
  const sidebar = $("[data-sidebar]");
  const backdrop = $("[data-sidebar-backdrop]");
  const open = () => {
    sidebar?.classList.remove("-translate-x-full");
    backdrop?.classList.remove("hidden");
    ($("a", sidebar ?? document) as HTMLElement | null)?.focus();
  };
  const close = () => {
    sidebar?.classList.add("-translate-x-full");
    backdrop?.classList.add("hidden");
  };
  $("[data-sidebar-open]")?.addEventListener("click", open);
  $("[data-sidebar-close]")?.addEventListener("click", close);
  backdrop?.addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());
  $("[data-sidebar-collapse]")?.addEventListener("click", () => {
    const d = document.documentElement;
    const collapsed = d.dataset.sidebar === "collapsed";
    if (collapsed) delete d.dataset.sidebar;
    else d.dataset.sidebar = "collapsed";
    try {
      localStorage.setItem("sidebar", collapsed ? "open" : "collapsed");
    } catch {
      /* ignore */
    }
  });

  // <details data-menu>: close on outside click / Escape
  document.addEventListener("click", (e) => {
    for (const d of $$<HTMLDetailsElement>("details[data-menu][open]")) if (!d.contains(e.target as Node)) d.open = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    for (const d of $$<HTMLDetailsElement>("details[data-menu][open]")) {
      d.open = false;
      ($("summary", d) as HTMLElement | null)?.focus();
    }
  });

  // Toasts from server flash
  for (const t of $$("[data-toast]")) setTimeout(() => t.remove(), 6000);

  // Confirm dialogs on destructive buttons
  document.addEventListener(
    "click",
    (e) => {
      const btn = (e.target as Element).closest<HTMLElement>("[data-confirm]");
      if (btn && !confirm(btn.dataset.confirm)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true,
  );

  // Auto-submit filters
  for (const el of $$<HTMLInputElement | HTMLSelectElement>("[data-autosubmit]")) el.addEventListener("change", () => el.form?.requestSubmit());
  for (const el of $$<HTMLInputElement>("[data-select-on-focus]")) el.addEventListener("focus", () => el.select());

  // Recovery codes helpers
  $("[data-copy-codes]")?.addEventListener("click", async () => {
    const text = $$("[data-codes] li").map((li) => li.textContent?.trim()).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast("Recovery codes copied.", "success");
    } catch {
      toast("Copy failed — select and copy them manually.", "error");
    }
  });
  $("[data-print]")?.addEventListener("click", () => print());

  // Error summary focus
  ($("[data-error-summary]") as HTMLElement | null)?.focus();
}
