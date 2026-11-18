import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { settings } from "../db/schema/index.js";
import { bust, cached } from "../lib/cache.js";
import * as D from "../db/seed/data-profile.js";

export const SETTING_DEFAULTS = {
  profile: D.profile,
  branding: D.branding,
  seo: D.seoDefaults,
  integrations: D.integrations,
  site: D.siteSettings,
  setup: { completedAt: null as string | null, seeded: false },
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] };

/** All settings merged over defaults. Cached; busted by saveSetting(). Falls back to defaults if the DB is down. */
export async function getSettings(): Promise<Settings> {
  return cached("settings", ["settings"], async () => {
    const rows = await db.select().from(settings);
    const out = structuredClone(SETTING_DEFAULTS) as Settings;
    for (const r of rows) {
      if (r.key in out) {
        const k = r.key as SettingKey;
        (out as Record<string, unknown>)[k] = { ...(out[k] as object), ...(r.value as object) };
      }
    }
    return out;
  });
}

export async function saveSetting<K extends SettingKey>(key: K, value: Partial<Settings[K]>): Promise<Settings[K]> {
  const current = (await getSettings())[key];
  const merged = { ...(current as object), ...(value as object) } as Settings[K];
  await db
    .insert(settings)
    .values({ key, value: merged })
    .onDuplicateKeyUpdate({ set: { value: merged } });
  bust("settings", "all");
  return merged;
}

export async function getRawSetting(key: string): Promise<unknown> {
  const r = await db.select().from(settings).where(eq(settings.key, key));
  return r[0]?.value;
}
