import * as db from "@/lib/db";
import {
  ENTITLEMENT_KEYS,
  entitlementsForPlan,
  type EntitlementKey,
} from "@/lib/billing/plans";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";

export const FEATURE_FLAGS: Record<
  EntitlementKey,
  {
    key: EntitlementKey;
    label: string;
    description: string;
    default: boolean;
  }
> = {
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
    description: "Legacy alias for charity campaigns, donations and Gift Aid.",
    default: true,
  },
  charity_campaigns: {
    key: "charity_campaigns",
    label: "Charity campaigns",
    description: "Campaigns, donor history and campaign reporting.",
    default: true,
  },
  charity_reports: {
    key: "charity_reports",
    label: "Charity reports",
    description: "Raised totals, consent gaps and Gift Aid reclaimable.",
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
  member_portal: {
    key: "member_portal",
    label: "Member portal",
    description: "Member self-serve portal and installable app.",
    default: true,
  },
  digital_lodge_card: {
    key: "digital_lodge_card",
    label: "Digital lodge card",
    description: "Member lodge card always to hand.",
    default: true,
  },
  payments: {
    key: "payments",
    label: "Payments",
    description: "Mooov-backed checkout and reconciliation.",
    default: true,
  },
  dues: {
    key: "dues",
    label: "Dues",
    description: "Dues modelling, runs and reminders.",
    default: true,
  },
  gift_aid: {
    key: "gift_aid",
    label: "Gift Aid",
    description: "Declarations, eligibility tracking and HMRC-ready exports.",
    default: true,
  },
  gasds: {
    key: "gasds",
    label: "GASDS",
    description: "Small cash donation tracking and annual allowance reporting.",
    default: true,
  },
  meetings: {
    key: "meetings",
    label: "Meetings",
    description: "Meeting records and attendance.",
    default: true,
  },
  summons: {
    key: "summons",
    label: "Summons",
    description: "Summons workflow, links, print, send and history.",
    default: true,
  },
  events: {
    key: "events",
    label: "Events",
    description: "RSVPs, guests, dining and dietary tracking.",
    default: true,
  },
  treasurer_reports: {
    key: "treasurer_reports",
    label: "Treasurer reports",
    description: "Income breakdowns, dues posture and reclaimable Gift Aid.",
    default: true,
  },
  secretary_reports: {
    key: "secretary_reports",
    label: "Secretary reports",
    description: "Summons coverage, RSVP health and data gaps.",
    default: true,
  },
  candidate_crm: {
    key: "candidate_crm",
    label: "Candidate CRM",
    description: "Pipeline, proposer assignment, ballot and initiation stages.",
    default: true,
  },
  recruitment_reports: {
    key: "recruitment_reports",
    label: "Recruitment reports",
    description: "Funnel counts, source attribution and pipeline freshness.",
    default: true,
  },
  audit: {
    key: "audit",
    label: "Audit trail",
    description: "Accountability for sensitive actions.",
    default: true,
  },
  bulk_import: {
    key: "bulk_import",
    label: "Bulk member import",
    description: "Bulk member CSV import.",
    default: true,
  },
  advanced_members: {
    key: "advanced_members",
    label: "Advanced member records",
    description: "Advanced fields, ranks and lifecycle tracking.",
    default: true,
  },
  multi_lodge: {
    key: "multi_lodge",
    label: "Multiple lodges",
    description: "Separate records for connected lodges.",
    default: true,
  },
  cross_lodge_reporting: {
    key: "cross_lodge_reporting",
    label: "Cross-lodge reporting",
    description: "Roll-up reporting across lodges.",
    default: true,
  },
  central_billing: {
    key: "central_billing",
    label: "Central billing",
    description: "One invoice for connected lodges.",
    default: true,
  },
  province_dashboards: {
    key: "province_dashboards",
    label: "Provincial dashboards",
    description: "Province-wide rollout and portfolio dashboards.",
    default: true,
  },
  migration_planning: {
    key: "migration_planning",
    label: "Migration planning",
    description: "Migration support from legacy systems and spreadsheets.",
    default: true,
  },
  named_support: {
    key: "named_support",
    label: "Named support",
    description: "Provincial support desk and named contact.",
    default: true,
  },
  guest_links: {
    key: "guest_links",
    label: "Guest links",
    description: "Guest directory, member self-invite links, visitor portal.",
    default: true,
  },
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const cache = new Map<string, { ts: number; value: Record<string, boolean> }>();
const TTL_MS = 30_000;

async function loadFlags(lodgeId: string): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured()) return {};
  const now = Date.now();
  const cached = cache.get(lodgeId);
  if (cached && now - cached.ts < TTL_MS) return cached.value;
  const rows = await db.listLodgeFeatureFlags(lodgeId);
  const subscription = await db.getLodgeSubscription(lodgeId).catch(() => null);
  const value: Record<string, boolean> = entitlementsForPlan(
    subscription?.plan_code
  );
  value.charity =
    value.charity_campaigns || value.gift_aid || value.gasds || false;
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
  for (const key of ENTITLEMENT_KEYS) {
    out[key] = key in flags ? flags[key] : FEATURE_FLAGS[key].default;
  }
  out.charity =
    flags.charity ??
    (out.charity_campaigns || out.gift_aid || out.gasds || false);
  return out;
}

export function clearFeatureFlagCache(lodgeId?: string) {
  if (lodgeId) cache.delete(lodgeId);
  else cache.clear();
}
