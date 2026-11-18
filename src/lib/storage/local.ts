import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types.js";

export function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,250}$/i.test(key) || key.includes("..") || key.includes("//")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

export class LocalStorage implements StorageDriver {
  readonly name = "local" as const;
  constructor(private readonly root: string) {}

  private file(key: string): string {
    const p = path.resolve(this.root, safeKey(key));
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Path escapes storage root");
    return p;
  }

  async put(key: string, body: Buffer, _contentType?: string): Promise<void> {
    const p = this.file(key);
    await fsp.mkdir(path.dirname(p), { recursive: true });
    const tmp = `${p}.${process.pid}.tmp`;
    await fsp.writeFile(tmp, body);
    await fsp.rename(tmp, p);
  }

  async get(key: string) {
    try {
      const p = this.file(key);
      const st = await fsp.stat(p);
      if (!st.isFile()) return null;
      return { body: fs.createReadStream(p), size: st.size, mtime: st.mtime, etag: `"${st.size.toString(16)}-${st.mtimeMs.toString(16)}"` };
    } catch {
      return null;
    }
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    try {
      return await fsp.readFile(this.file(key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await fsp.rm(this.file(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fsp.access(this.file(key));
      return true;
    } catch {
      return false;
    }
  }

  async health() {
    try {
      await fsp.mkdir(this.root, { recursive: true });
      const probe = path.join(this.root, `.write-test-${process.pid}`);
      await fsp.writeFile(probe, "ok");
      await fsp.rm(probe);
      const inside = path.resolve(this.root).startsWith(path.resolve(process.cwd()) + path.sep);
      return {
        ok: !inside,
        detail: inside
          ? `UPLOAD_DIR (${this.root}) is inside the app folder — uploads will be lost on redeploy. Move it outside.`
          : `Writable: ${this.root}`,
      };
    } catch (e) {
      return { ok: false, detail: `Not writable: ${this.root} (${(e as Error).message})` };
    }
  }
}
