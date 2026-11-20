import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute project root, derived from this file's location (src/config or dist/config → ../..).
 * Never use process.cwd(): hosts such as Hostinger may start dist/server.js from another directory.
 */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const fromRoot = (...p: string[]): string => path.join(ROOT, ...p);
