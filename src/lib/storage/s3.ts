import type { Readable } from "node:stream";
import type { StorageDriver } from "./types.js";
import { safeKey } from "./local.js";

type S3Mod = typeof import("@aws-sdk/client-s3");

/** S3-compatible driver (Cloudflare R2, AWS S3, Backblaze…). The SDK is loaded lazily to keep cold starts fast. */
export class S3Storage implements StorageDriver {
  readonly name = "s3" as const;
  private mod?: S3Mod;
  private client?: InstanceType<S3Mod["S3Client"]>;
  constructor(
    private readonly cfg: { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string },
  ) {}

  private async c() {
    if (!this.client) {
      this.mod = await import("@aws-sdk/client-s3");
      this.client = new this.mod.S3Client({
        endpoint: this.cfg.endpoint,
        region: this.cfg.region,
        forcePathStyle: true,
        credentials: { accessKeyId: this.cfg.accessKeyId, secretAccessKey: this.cfg.secretAccessKey },
      });
    }
    return { client: this.client, m: this.mod! };
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, m } = await this.c();
    await client.send(
      new m.PutObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key), Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
    );
  }

  async get(key: string) {
    const { client, m } = await this.c();
    try {
      const r = await client.send(new m.GetObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key) }));
      return { body: r.Body as Readable, size: r.ContentLength, contentType: r.ContentType, etag: r.ETag, mtime: r.LastModified };
    } catch {
      return null;
    }
  }

  async getBuffer(key: string): Promise<Buffer | null> {
    const r = await this.get(key);
    if (!r) return null;
    const chunks: Buffer[] = [];
    for await (const ch of r.body) chunks.push(Buffer.from(ch as Uint8Array));
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const { client, m } = await this.c();
    await client.send(new m.DeleteObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key) }));
  }

  async exists(key: string): Promise<boolean> {
    const { client, m } = await this.c();
    try {
      await client.send(new m.HeadObjectCommand({ Bucket: this.cfg.bucket, Key: safeKey(key) }));
      return true;
    } catch {
      return false;
    }
  }

  async health() {
    try {
      const { client, m } = await this.c();
      await client.send(new m.HeadBucketCommand({ Bucket: this.cfg.bucket }));
      return { ok: true, detail: `Bucket reachable: ${this.cfg.bucket}` };
    } catch (e) {
      return { ok: false, detail: `S3 bucket unreachable: ${(e as Error).message}` };
    }
  }
}
