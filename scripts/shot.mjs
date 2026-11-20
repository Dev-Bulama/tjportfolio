// Usage: node scripts/shot.mjs <url> <out.png> [width] [height] [fullPage] [theme] [scale]
import { chromium } from "playwright";
const [url, out, w = "1440", h = "900", full = "1", theme = "light", scale = "1"] = process.argv.slice(2);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +scale, colorScheme: theme, reducedMotion: "reduce" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("console errors:", errors.join("\n"));
await browser.close();
