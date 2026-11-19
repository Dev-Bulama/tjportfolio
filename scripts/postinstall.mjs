// Safety net for hosts that run `npm install` but no build command (e.g. hPanel with
// "Build command: none"): if the compiled server is missing, build it right after install.
// Skipped when dist/ already exists, or when SKIP_POSTINSTALL_BUILD=1.
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
if (process.env.SKIP_POSTINSTALL_BUILD === "1") process.exit(0);
if (existsSync(path.join(root, "dist", "server.js"))) process.exit(0);
// Only build from a full source checkout (not when installed as someone else's dependency).
if (!existsSync(path.join(root, "src", "server.ts"))) process.exit(0);

console.log("postinstall: dist/server.js not found — running `npm run build`…");
execSync("npm run build", { cwd: root, stdio: "inherit" });
