// Public-site behaviour. Progressive enhancement only: every page works without JS.

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T & Element>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T & Element>(sel));
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const csrf = (): string => ($<HTMLInputElement>('input[name="_csrf"]')?.value ?? "");

// ── Theme toggle ────────────────────────────────────────────────────────────────────────────────
for (const btn of $$("[data-theme-toggle]")) {
  btn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: theme still applies for this page */
    }
  });
}

// ── Sticky header shrink ────────────────────────────────────────────────────────────────────────
const header = $("[data-header]");
if (header) {
  const onScroll = () => header.setAttribute("data-scrolled", String(window.scrollY > 24));
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
}

// ── Mobile menu (native <dialog>: focus trap + Escape for free) ─────────────────────────────────
const menu = $<HTMLDialogElement>("#mobile-menu");
const openBtn = $("[data-menu-open]");
if (menu && openBtn) {
  openBtn.addEventListener("click", () => {
    menu.showModal();
    openBtn.setAttribute("aria-expanded", "true");
  });
  menu.addEventListener("close", () => openBtn.setAttribute("aria-expanded", "false"));
  $("[data-menu-close]", menu)?.addEventListener("click", () => menu.close());
  menu.addEventListener("click", (e) => {
    if (e.target === menu) menu.close();
  });
}

// ── Reveal on scroll + count-up stats ───────────────────────────────────────────────────────────
const reveals = $$(".reveal");
if (reduced || !("IntersectionObserver" in window)) {
  reveals.forEach((el) => el.classList.add("is-visible"));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
  );
  reveals.forEach((el) => io.observe(el));
}
if (!reduced) {
  const counters = $$("[data-count]");
  const cio = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target as HTMLElement;
      const target = Number(el.dataset.count ?? 0);
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1400);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(target * eased).toLocaleString("en-US");
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      cio.unobserve(el);
    }
  });
  counters.forEach((c) => cio.observe(c));
}

// ── Carousel (scroll-snap + buttons; pauses on hover/focus) ─────────────────────────────────────
for (const root of $$("[data-carousel]")) {
  const track = $("[data-carousel-track]", root)!;
  const step = () => (track.firstElementChild as HTMLElement | null)?.getBoundingClientRect().width ?? track.clientWidth;
  const go = (dir: 1 | -1) => {
    const max = track.scrollWidth - track.clientWidth - 4;
    if (dir === 1 && track.scrollLeft >= max) track.scrollTo({ left: 0, behavior: reduced ? "auto" : "smooth" });
    else track.scrollBy({ left: dir * (step() + 24), behavior: reduced ? "auto" : "smooth" });
  };
  $("[data-carousel-prev]", root)?.addEventListener("click", () => go(-1));
  $("[data-carousel-next]", root)?.addEventListener("click", () => go(1));
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") go(1);
    if (e.key === "ArrowLeft") go(-1);
  });
  let paused = false;
  for (const ev of ["mouseenter", "focusin"]) root.addEventListener(ev, () => (paused = true));
  for (const ev of ["mouseleave", "focusout"]) root.addEventListener(ev, () => (paused = false));
  if (!reduced && root.dataset.autoplay !== "false") setInterval(() => !paused && !document.hidden && go(1), 7000);
}

// ── Lightbox (gallery, case-study images, certificates) ─────────────────────────────────────────
const lb = $<HTMLDialogElement>("#lightbox");
if (lb) {
  const groups = new Map<string, HTMLAnchorElement[]>();
  for (const a of $$<HTMLAnchorElement>("[data-lightbox]")) {
    const g = a.dataset.lightbox || "default";
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }
  let list: HTMLAnchorElement[] = [];
  let idx = 0;
  const imgEl = $<HTMLImageElement>("[data-lb-img]", lb)!;
  const cap = $("[data-lb-caption]", lb)!;
  const counter = $("[data-lb-count]", lb)!;
  const show = (i: number) => {
    idx = (i + list.length) % list.length;
    const a = list[idx]!;
    imgEl.src = a.href;
    imgEl.alt = a.dataset.alt ?? "";
    cap.textContent = a.dataset.caption ?? "";
    counter.textContent = list.length > 1 ? `${idx + 1} / ${list.length}` : "";
  };
  for (const [, items] of groups) {
    items.forEach((a, i) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        list = items;
        show(i);
        lb.showModal();
      }),
    );
  }
  $("[data-lb-prev]", lb)?.addEventListener("click", () => show(idx - 1));
  $("[data-lb-next]", lb)?.addEventListener("click", () => show(idx + 1));
  $("[data-lb-close]", lb)?.addEventListener("click", () => lb.close());
  lb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") show(idx + 1);
    if (e.key === "ArrowLeft") show(idx - 1);
  });
  lb.addEventListener("click", (e) => {
    if (e.target === lb) lb.close();
  });
}

// ── Generic modal openers (certificate viewer etc.) ─────────────────────────────────────────────
for (const btn of $$("[data-open-dialog]")) {
  const d = document.getElementById(btn.dataset.openDialog!) as HTMLDialogElement | null;
  if (!d) continue;
  btn.addEventListener("click", () => {
    d.showModal();
    track("certificate_view", btn.dataset.label);
  });
  $$("[data-close-dialog]", d).forEach((c) => c.addEventListener("click", () => d.close()));
  d.addEventListener("click", (e) => e.target === d && d.close());
}

// ── Filterable grids (/work, /training, /certifications, /testimonials) ─────────────────────────
for (const root of $$("[data-filter-root]")) {
  const items = $$("[data-category]", root);
  const tabs = $$<HTMLButtonElement>("[data-filter]", root);
  const search = $<HTMLInputElement>("[data-search]", root);
  const sort = $<HTMLSelectElement>("[data-sort]", root);
  const tag = $<HTMLSelectElement>("[data-tag]", root);
  const grid = $("[data-grid]", root);
  const empty = $("[data-empty]", root);
  const count = $("[data-count-label]", root);
  let current = new URLSearchParams(location.search).get("category") ?? "all";
  const apply = () => {
    const q = (search?.value ?? "").trim().toLowerCase();
    const t = tag?.value ?? "";
    let shown = 0;
    for (const el of items) {
      const ok =
        (current === "all" || el.dataset.category === current) &&
        (!q || (el.dataset.title ?? el.textContent ?? "").toLowerCase().includes(q)) &&
        (!t || (el.dataset.tags ?? "").split("|").includes(t));
      (el.closest("[data-item]") ?? el).toggleAttribute("hidden", !ok);
      if (ok) shown++;
      if (ok) el.classList.add("is-visible");
    }
    tabs.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.filter === current)));
    if (empty) empty.hidden = shown > 0;
    if (count) count.textContent = `${shown} ${shown === 1 ? "item" : "items"}`;
    const url = new URL(location.href);
    if (current === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", current);
    history.replaceState(null, "", url);
  };
  tabs.forEach((b) =>
    b.addEventListener("click", () => {
      current = b.dataset.filter ?? "all";
      apply();
    }),
  );
  search?.addEventListener("input", apply);
  tag?.addEventListener("change", apply);
  sort?.addEventListener("change", () => {
    if (!grid) return;
    const els = $$("[data-item]", grid);
    const key = (el: Element) => (el.querySelector("[data-category]") as HTMLElement | null) ?? (el as HTMLElement);
    els.sort((a, b) => {
      const A = key(a).dataset;
      const B = key(b).dataset;
      if (sort.value === "az") return (A.title ?? "").localeCompare(B.title ?? "");
      if (sort.value === "newest") return Number(B.year ?? 0) - Number(A.year ?? 0);
      return Number(A.order ?? 0) - Number(B.order ?? 0);
    });
    els.forEach((el) => grid.appendChild(el));
  });
  for (const btn of $$<HTMLButtonElement>("[data-view]", root)) {
    btn.addEventListener("click", () => {
      root.dataset.layout = btn.dataset.view;
      $$("[data-view]", root).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      try {
        localStorage.setItem("work-view", btn.dataset.view ?? "grid");
      } catch {
        /* ignore */
      }
    });
  }
  try {
    const v = localStorage.getItem("work-view");
    if (v) $<HTMLButtonElement>(`[data-view="${v}"]`, root)?.click();
  } catch {
    /* ignore */
  }
  apply();
}

// ── AJAX forms with inline errors (fallback: normal POST) ───────────────────────────────────────
for (const form of $$<HTMLFormElement>("form[data-ajax-form]")) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = $("[data-form-status]", form);
    const btn = $<HTMLButtonElement>('button[type="submit"]', form);
    $$("[data-error-for]", form).forEach((el) => (el.textContent = ""));
    $$("[aria-invalid]", form).forEach((el) => el.removeAttribute("aria-invalid"));
    if (btn) btn.disabled = true;
    if (status) status.textContent = "Sending…";
    try {
      const fd = new FormData(form);
      const multipart = form.enctype === "multipart/form-data";
      const res = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json", "x-csrf-token": csrf(), ...(multipart ? {} : { "Content-Type": "application/x-www-form-urlencoded" }) },
        body: multipart ? fd : new URLSearchParams(fd as unknown as Record<string, string>),
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string; errors?: Record<string, string>; redirect?: string; html?: string };
      if (data.ok) {
        if (data.redirect) return void (location.href = data.redirect);
        const done = $("[data-form-success]", form.parentElement ?? document);
        if (done && data.html) {
          done.innerHTML = data.html;
          done.hidden = false;
          form.hidden = true;
          done.focus();
        } else if (status) status.textContent = data.message ?? "Done.";
        form.reset();
        track(form.dataset.event ?? "form_submit");
        (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      } else {
        const errs = data.errors ?? {};
        const lines: string[] = [];
        for (const [name, msg] of Object.entries(errs)) {
          const field = form.elements.namedItem(name) as HTMLElement | null;
          field?.setAttribute("aria-invalid", "true");
          const slot = $(`[data-error-for="${name}"]`, form);
          if (slot) slot.textContent = msg;
          lines.push(msg);
        }
        if (status) status.textContent = data.error ?? (lines.length ? `Please fix ${lines.length} field${lines.length > 1 ? "s" : ""}: ${lines.join(" ")}` : "Something went wrong. Please try again.");
        const first = Object.keys(errs)[0];
        if (first) (form.elements.namedItem(first) as HTMLElement | null)?.focus();
        (window as unknown as { turnstile?: { reset: () => void } }).turnstile?.reset();
      }
    } catch {
      if (status) status.textContent = "Network error — please check your connection and try again.";
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// ── Click-to-load embeds (Calendly / Maps / YouTube) — no third-party JS until asked ────────────
for (const btn of $$<HTMLButtonElement>("[data-embed-src]")) {
  btn.addEventListener("click", () => {
    const f = document.createElement("iframe");
    f.src = btn.dataset.embedSrc!;
    f.title = btn.dataset.embedTitle ?? "Embedded content";
    f.loading = "lazy";
    f.className = "h-full w-full";
    f.allow = "fullscreen; encrypted-media; picture-in-picture";
    f.referrerPolicy = "strict-origin-when-cross-origin";
    btn.replaceWith(f);
  });
}

// ── Table of contents highlighting ──────────────────────────────────────────────────────────────
const tocLinks = $$<HTMLAnchorElement>(".toc a");
if (tocLinks.length && "IntersectionObserver" in window) {
  const map = new Map(tocLinks.map((a) => [a.hash.slice(1), a]));
  const tio = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        tocLinks.forEach((a) => a.removeAttribute("aria-current"));
        map.get(e.target.id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "0px 0px -70% 0px" },
  );
  map.forEach((_a, id) => {
    const h = document.getElementById(id);
    if (h) tio.observe(h);
  });
}

// ── Print buttons
for (const b of $$("[data-print-page]")) b.addEventListener("click", () => print());

// ── Share buttons (copy link) ───────────────────────────────────────────────────────────────────
for (const b of $$("[data-copy-link]")) {
  b.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      b.textContent = "Link copied";
    } catch {
      /* clipboard denied */
    }
  });
}

// ── Privacy-friendly analytics beacon (no cookies; honours Do-Not-Track) ────────────────────────
const dnt = navigator.doNotTrack === "1" || (window as unknown as { doNotTrack?: string }).doNotTrack === "1";
function send(payload: Record<string, unknown>) {
  if (dnt) return;
  const body = JSON.stringify(payload);
  if (!navigator.sendBeacon?.("/api/collect", new Blob([body], { type: "application/json" }))) {
    void fetch("/api/collect", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}
export function track(name: string, label?: string) {
  send({ t: "event", name, label, path: location.pathname });
}
if (!document.documentElement.dataset.noTrack) {
  send({ t: "pageview", path: location.pathname, ref: document.referrer, q: location.search, w: window.innerWidth });
}
document.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLElement>("[data-track]");
  if (a) track(a.dataset.track!, a.dataset.label ?? (a as HTMLAnchorElement).href);
});
