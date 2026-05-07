import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";

export const FEATURE_FLAGS = {
  ai: {
    key: "ai",
    label: "AI assistant",
    description: "Summons drafting, post-meeting summaries, members at risk.",
    default: true,
  },
  integrations: {
    key: "integrations",
    label: "Integrations",
    description: "Calendar, email and accounting connectors plus job queue UI.",
    default: true,
  },
  charity: {
    key: "charity",
    label: "Charity & Gift Aid",
    description: "Charity campaigns, donations and Gift Aid declarations.",
    default: true,
  },
  almoner: {
    key: "almoner",
    label: "Almoner welfare",
    description: "Welfare cases, visits log, bereavement register, alerts.",
    default: true,
  },
  mentor: {
    key: "mentor",
    label: "Mentor & progression",
    description: "Mentor assignments, progression sign-off, officer ladder.",
    default: true,
  },
  site_builder: {
    key: "site_builder",
    label: "Public site builder",
    description: "Drag-and-drop public site builder for the lodge.",
    default: true,
  },
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const cache = new Map<string, { ts: number; value: Record<string, boolean> }>();
const TTL_MS = 30_000;

async function loadFlags(lodgeId: string): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured()) return {};
  const now = Date.now();
  const cached = cache.get(lodgeId);
  if (cached && now - cached.ts < TTL_MS) return cached.value;
  const rows = await db.listLodgeFeatureFlags(lodgeId);
  const value: Record<string, boolean> = {};
  for (const row of rows) value[row.flag_key] = row.enabled;
  cache.set(lodgeId, { ts: now, value });
  return value;
}

export async function isFeatureEnabled(
  lodgeId: string | null | undefined,
  flagKey: FeatureFlagKey
): Promise<boolean> {
  const meta = FEATURE_FLAGS[flagKey];
  if (!lodgeId) return meta.default;
  try {
    const flags = await loadFlags(lodgeId);
    if (flagKey in flags) return flags[flagKey];
    return meta.default;
  } catch {
    return meta.default;
  }
}

export async function getAllFlagsForLodge(
  lodgeId: string
): Promise<Record<FeatureFlagKey, boolean>> {
  const flags = await loadFlags(lodgeId);
  const out = {} as Record<FeatureFlagKey, boolean>;
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]) {
    out[key] = key in flags ? flags[key] : FEATURE_FLAGS[key].default;
  }
  return out;
}

export function clearFeatureFlagCache(lodgeId?: string) {
  if (lodgeId) cache.delete(lodgeId);
  else cache.clear();
}
