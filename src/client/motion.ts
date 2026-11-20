// Decorative motion for the public site. Everything here is optional polish: it starts after first
// paint, pauses in background tabs, and is skipped entirely under prefers-reduced-motion.

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const visible = () => new Promise<void>((r) => (document.hidden ? document.addEventListener("visibilitychange", () => r(), { once: true }) : r()));

/** Rotating typewriter: types each line, holds, deletes, moves on. The first line is server-rendered. */
async function typewriter(root: HTMLElement): Promise<void> {
  let lines: string[];
  try {
    lines = JSON.parse(root.dataset.typewriter ?? "[]") as string[];
  } catch {
    return;
  }
  const out = root.querySelector<HTMLElement>("[data-typewriter-text]");
  if (!out || lines.length < 2) return;
  let i = 0;
  await sleep(2600);
  for (;;) {
    await visible();
    const current = lines[i]!;
    for (let n = current.length; n >= 0; n--) {
      out.textContent = current.slice(0, n);
      await sleep(18);
    }
    i = (i + 1) % lines.length;
    const next = lines[i]!;
    await sleep(260);
    for (let n = 1; n <= next.length; n++) {
      out.textContent = next.slice(0, n);
      await sleep(next[n - 1] === " " ? 20 : 38 + Math.random() * 40);
    }
    await sleep(2600);
  }
}

/** Oracle terminal: types the command, then prints result lines one by one, then loops. */
async function terminal(pre: HTMLElement): Promise<void> {
  const lines = pre.innerHTML.split("\n");
  const [first, ...rest] = lines;
  const prompt = /^(<span[^>]*>SQL&gt;<\/span>\s?)(.*)$/.exec(first ?? "");
  if (!prompt) return;
  const command = prompt[2]!.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const cursor = '<span class="term-cursor"></span>';
  for (;;) {
    await visible();
    pre.innerHTML = prompt[1] + cursor;
    await sleep(700);
    for (let n = 1; n <= command.length; n++) {
      pre.innerHTML = prompt[1] + esc(command.slice(0, n)) + cursor;
      await sleep(28 + Math.random() * 45);
    }
    await sleep(450);
    let html = prompt[1] + esc(command);
    for (const line of rest) {
      html += `\n${line}`;
      pre.innerHTML = html + cursor;
      await sleep(line.trim() ? 170 : 90);
    }
    await sleep(6500);
  }
}

/** Gentle 3D tilt following the pointer (desktop only). */
function tilt(el: HTMLElement): void {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const card = el.querySelector<HTMLElement>(".hero-float");
  if (!card) return;
  el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.style.setProperty("--ry", `${(x * 8).toFixed(2)}deg`);
    card.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
  });
  el.addEventListener("pointerleave", () => {
    card.style.setProperty("--ry", "0deg");
    card.style.setProperty("--rx", "0deg");
  });
}

/** Cursor spotlight on hoverable cards. */
function spotlight(): void {
  if (!matchMedia("(hover: hover)").matches) return;
  document.addEventListener(
    "pointermove",
    (e) => {
      const card = (e.target as Element | null)?.closest?.<HTMLElement>(".card-hover");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
    { passive: true },
  );
}

/** Thin reading-progress bar at the top of the page. */
function progress(bar: HTMLElement): void {
  let ticking = false;
  const update = () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.setProperty("--p", String(h > 0 ? Math.min(1, scrollY / h) : 0));
    ticking = false;
  };
  addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

export function initMotion(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const start = () => {
    document.querySelectorAll<HTMLElement>("[data-typewriter]").forEach((el) => void typewriter(el));
    document.querySelectorAll<HTMLElement>("[data-terminal]").forEach((el) => void terminal(el));
    document.querySelectorAll<HTMLElement>("[data-tilt]").forEach(tilt);
    const bar = document.querySelector<HTMLElement>("[data-scroll-progress]");
    if (bar) progress(bar);
    spotlight();
  };
  // Start after the browser has painted and settled, so LCP and input stay unaffected.
  if ("requestIdleCallback" in window) (window as Window & { requestIdleCallback: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback(start, { timeout: 1200 });
  else setTimeout(start, 400);
}
