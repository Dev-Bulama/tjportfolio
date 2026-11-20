/** Detects file type from magic bytes — never trust the extension or the browser's MIME (brief §4.8). */
export type Sniffed = { mime: string; ext: string; kind: "image" | "pdf" } | null;

export function sniff(buf: Buffer): Sniffed {
  if (buf.length < 12) return null;
  const hex = buf.subarray(0, 12).toString("hex");
  if (hex.startsWith("ffd8ff")) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (hex.startsWith("89504e470d0a1a0a")) return { mime: "image/png", ext: "png", kind: "image" };
  if (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", ext: "avif", kind: "image" };
  }
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "pdf" };
  return null;
}
