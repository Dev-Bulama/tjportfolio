// Bundles browser code (src/client/*.ts) with esbuild and copies self-hosted fonts.
import { build, context } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "public/assets");
const fonts = path.join(root, "public/fonts");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(fonts, { recursive: true });

const copies = {
  "fraunces-opsz.woff2": "@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2",
  "fraunces-opsz-italic.woff2": "@fontsource-variable/fraunces/files/fraunces-latin-opsz-italic.woff2",
  "inter-opsz.woff2": "@fontsource-variable/inter/files/inter-latin-opsz-normal.woff2",
  "jetbrains-mono.woff2": "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
};
for (const [dest, src] of Object.entries(copies)) {
  fs.copyFileSync(path.join(root, "node_modules", src), path.join(fonts, dest));
}

const opts = {
  entryPoints: { site: "src/client/site.ts", admin: "src/client/admin.ts" },
  outdir: out,
  bundle: true,
  format: "esm",
  splitting: true,
  minify: true,
  sourcemap: false,
  target: ["es2020", "safari15"],
  chunkNames: "chunks/[name]-[hash]",
  absWorkingDir: root,
  logLevel: "info",
};

if (process.argv.includes("--watch")) {
  const ctx = await context(opts);
  await ctx.watch();
} else {
  await build(opts);
}
