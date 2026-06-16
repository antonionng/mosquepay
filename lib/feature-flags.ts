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
    description: "Notice drafting, post-service summaries, members at risk.",
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
  pastoral_care: {
    key: "pastoral_care",
    label: "PastoralCare",
    description: "Pastoral cases, visits log, bereavement register, and care alerts.",
    default: true,
  },
  mentor: {
    key: "mentor",
    label: "Discipleship mentoring",
    description: "Mentor assignments, contact logs, and discipleship follow-up.",
    default: true,
  },
  site_builder: {
    key: "site_builder",
    label: "Public site builder",
    description: "Drag-and-drop public site builder for the mosque.",
    default: true,
  },
  member_portal: {
    key: "member_portal",
    label: "Member portal",
    description: "Member self-serve portal and installable app.",
    default: true,
  },
  digital_mosque_card: {
    key: "digital_mosque_card",
    label: "Digital mosque card",
    description: "Member mosque card always to hand.",
    default: true,
  },
  payments: {
    key: "payments",
    label: "Payments",
    description: "Mooov-backed checkout and reconciliation.",
    default: true,
  },
  giving: {
    key: "giving",
    label: "Giving",
    description: "Giving modelling, runs and reminders.",
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
  services: {
    key: "services",
    label: "Services",
    description: "Service records and attendance.",
    default: true,
  },
  notice: {
    key: "notice",
    label: "Notice",
    description: "Notice workflow, links, print, send and history.",
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
    description: "Income breakdowns, giving posture and reclaimable Gift Aid.",
    default: true,
  },
  secretary_reports: {
    key: "secretary_reports",
    label: "Secretary reports",
    description: "Notice coverage, RSVP health and data gaps.",
    default: true,
  },
  newcomer_crm: {
    key: "newcomer_crm",
    label: "Newcomer CRM",
    description: "Pipeline, visit follow-up, membership class, and welcome stages.",
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
    description: "Advanced member fields, leadership roles, and lifecycle tracking.",
    default: true,
  },
  multi_mosque: {
    key: "multi_mosque",
    label: "Multiple mosques",
    description: "Separate records for connected mosques.",
    default: true,
  },
  cross_mosque_reporting: {
    key: "cross_mosque_reporting",
    label: "Cross-mosque reporting",
    description: "Roll-up reporting across mosques.",
    default: true,
  },
  central_billing: {
    key: "central_billing",
    label: "Central billing",
    description: "One invoice for connected mosques.",
    default: true,
  },
  network_dashboards: {
    key: "network_dashboards",
    label: "Network dashboards",
    description: "Network-wide rollout and portfolio dashboards.",
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
    description: "Network support desk and named contact.",
    default: true,
  },
  guest_links: {
    key: "guest_links",
    label: "Guest links",
    description: "Guest directory, member self-invite links, newcomer portal.",
    default: true,
  },
};

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

const cache = new Map<string, { ts: number; value: Record<string, boolean> }>();
const TTL_MS = 30_000;

async function loadFlags(mosqueId: string): Promise<Record<string, boolean>> {
  if (!isSupabaseConfigured()) return {};
  const now = Date.now();
  const cached = cache.get(mosqueId);
  if (cached && now - cached.ts < TTL_MS) return cached.value;
  const rows = await db.listMosqueFeatureFlags(mosqueId);
  const subscription = await db.getMosqueSubscription(mosqueId).catch(() => null);
  const value: Record<string, boolean> = entitlementsForPlan(
    subscription?.plan_code
  );
  value.charity =
    value.charity_campaigns || value.gift_aid || value.gasds || false;
  for (const row of rows) value[row.flag_key] = row.enabled;
  cache.set(mosqueId, { ts: now, value });
  return value;
}

export async function isFeatureEnabled(
  mosqueId: string | null | undefined,
  flagKey: FeatureFlagKey
): Promise<boolean> {
  const meta = FEATURE_FLAGS[flagKey];
  if (!mosqueId) return meta.default;
  try {
    const flags = await loadFlags(mosqueId);
    if (flagKey in flags) return flags[flagKey];
    return meta.default;
  } catch {
    return meta.default;
  }
}

export async function getAllFlagsForMosque(
  mosqueId: string
): Promise<Record<FeatureFlagKey, boolean>> {
  const flags = await loadFlags(mosqueId);
  const out = {} as Record<FeatureFlagKey, boolean>;
  for (const key of ENTITLEMENT_KEYS) {
    out[key] = key in flags ? flags[key] : FEATURE_FLAGS[key].default;
  }
  out.charity =
    flags.charity ??
    (out.charity_campaigns || out.gift_aid || out.gasds || false);
  return out;
}

export function clearFeatureFlagCache(mosqueId?: string) {
  if (mosqueId) cache.delete(mosqueId);
  else cache.clear();
}
