import type { Readable } from "node:stream";

export interface StorageDriver {
  readonly name: "local" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Readable; size?: number; contentType?: string; etag?: string; mtime?: Date } | null>;
  getBuffer(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  health(): Promise<{ ok: boolean; detail: string }>;
}
