/**
 * Tagged in-process data cache (PLAN D2). Public loaders wrap their DB queries in `cached()`;
 * admin mutations call `bust(tags)` so changes appear on the next request.
 */
type Entry = { value: unknown; expires: number; tags: string[] };
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const DEFAULT_TTL = 300_000;

export async function cached<T>(key: string, tags: string[], fn: () => Promise<T>, ttlMs = DEFAULT_TTL): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const p = fn()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs, tags: ["all", ...tags] });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function bust(...tags: string[]): void {
  const set = new Set(tags);
  for (const [k, e] of store) if (e.tags.some((t) => set.has(t))) store.delete(k);
}

export function bustAll(): void {
  store.clear();
}

export function cacheSize(): number {
  return store.size;
}
