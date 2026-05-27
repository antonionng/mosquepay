export const PLAN_CODES = [
  "lodge_essentials",
  "lodge_complete",
  "lodge_group",
  "province",
] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export const ENTITLEMENT_KEYS = [
  "site_builder",
  "member_portal",
  "digital_lodge_card",
  "payments",
  "dues",
  "gift_aid",
  "gasds",
  "meetings",
  "summons",
  "events",
  "treasurer_reports",
  "secretary_reports",
  "charity",
  "candidate_crm",
  "almoner",
  "charity_campaigns",
  "charity_reports",
  "recruitment_reports",
  "audit",
  "bulk_import",
  "advanced_members",
  "multi_lodge",
  "cross_lodge_reporting",
  "central_billing",
  "province_dashboards",
  "migration_planning",
  "named_support",
  "ai",
  "integrations",
  "mentor",
  "guest_links",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export type PlanDefinition = {
  code: PlanCode;
  name: string;
  tag: string;
  price: string;
  subPrice: string;
  description: string;
  cta: string;
  recommended?: boolean;
  upgradeTo?: PlanCode;
  featureGroups: Array<{
    title: string;
    items: string[];
  }>;
  entitlements: EntitlementKey[];
};

const ESSENTIALS_ENTITLEMENTS: EntitlementKey[] = [
  "site_builder",
  "member_portal",
  "digital_lodge_card",
  "payments",
  "dues",
  "gift_aid",
  "gasds",
  "meetings",
  "summons",
  "events",
  "treasurer_reports",
  "secretary_reports",
  "charity",
  "guest_links",
  // The /admin/integrations page is the only UI surface that exposes
  // Mooov Connect (connect, reconnect, disconnect, repair). Mooov is the
  // payments rail and `payments` is already an Essentials entitlement, so
  // gating its setup UI to Province made it impossible for any paying
  // Essentials/Complete/Group lodge to actually administer their own
  // Mooov merchant. Calendar / email / accounting connectors on this
  // page are non-destructive (each one is its own toggle), so promoting
  // the page itself doesn't auto-enable a paid integration.
  "integrations",
];

const COMPLETE_EXTRA_ENTITLEMENTS: EntitlementKey[] = [
  "candidate_crm",
  "almoner",
  "charity_campaigns",
  "charity_reports",
  "recruitment_reports",
  "audit",
  "bulk_import",
  "advanced_members",
  "mentor",
  "ai",
];

const GROUP_EXTRA_ENTITLEMENTS: EntitlementKey[] = [
  "multi_lodge",
  "cross_lodge_reporting",
  "central_billing",
];

const PROVINCE_EXTRA_ENTITLEMENTS: EntitlementKey[] = [
  "province_dashboards",
  "migration_planning",
  "named_support",
];

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  lodge_essentials: {
    code: "lodge_essentials",
    name: "Essentials",
    tag: "Single Lodge",
    price: "From £149/mo",
    subPrice: "billed annually, or £169 monthly",
    description:
      "Everything an officer team needs to run the lodge, take payments, and reclaim every penny of Gift Aid the lodge is owed.",
    cta: "Get a walkthrough",
    upgradeTo: "lodge_complete",
    featureGroups: [
      {
        title: "The lodge, online",
        items: ["Public lodge website", "Member portal & PWA", "Digital lodge card"],
      },
      {
        title: "The money, handled",
        items: [
          "Mooov payment orchestration",
          "Bank import & reconciliation",
          "Treasurer report",
        ],
      },
      {
        title: "Gift Aid, everywhere",
        items: [
          "Gift Aid on dues & donations",
          "GASDS cash tracking",
          "HMRC-ready exports",
        ],
      },
      {
        title: "Meetings & dues",
        items: [
          "Summons workflow",
          "RSVPs & dietary tracking",
          "Bulk dues & reminders",
        ],
      },
    ],
    entitlements: ESSENTIALS_ENTITLEMENTS,
  },
  lodge_complete: {
    code: "lodge_complete",
    name: "Complete",
    tag: "Most Lodges Choose This",
    price: "From £229/mo",
    subPrice: "billed annually, or £259 monthly",
    description:
      "Everything in Essentials, plus the AI assistant, candidate pipeline, Almoner welfare, and full reporting suite.",
    cta: "Get a walkthrough",
    recommended: true,
    upgradeTo: "lodge_group",
    featureGroups: [
      {
        title: "Everything in Essentials, plus:",
        items: [
          "AI assistant for drafting",
          "Members-at-risk insights",
          "Post-meeting summaries",
          "Data quality checks",
        ],
      },
      {
        title: "Membership & care",
        items: [
          "Candidate CRM & pipeline",
          "Almoner welfare cases",
          "Mentor assignment & sign-off",
          "Charity campaigns",
        ],
      },
      {
        title: "Reports & compliance",
        items: [
          "Charity & recruitment reports",
          "Full audit trail",
          "SAR & consent management",
        ],
      },
    ],
    entitlements: [
      ...ESSENTIALS_ENTITLEMENTS,
      ...COMPLETE_EXTRA_ENTITLEMENTS,
    ],
  },
  lodge_group: {
    code: "lodge_group",
    name: "Group",
    tag: "2 to 6 lodges",
    price: "From £349/mo",
    subPrice: "2 lodges, then £119 per extra",
    description:
      "Everything in Complete for halls, groups, or connected lodges with shared oversight and central billing.",
    cta: "Get a walkthrough",
    upgradeTo: "province",
    featureGroups: [
      {
        title: "Everything in Complete, plus:",
        items: [
          "Separate lodge records",
          "Per-lodge branding & site",
          "Cross-lodge reporting",
          "Central billing, one invoice",
          "Lodge context switching",
          "Multi-lodge member visibility",
          "Shared rollout support",
        ],
      },
    ],
    entitlements: [
      ...ESSENTIALS_ENTITLEMENTS,
      ...COMPLETE_EXTRA_ENTITLEMENTS,
      ...GROUP_EXTRA_ENTITLEMENTS,
    ],
  },
  province: {
    code: "province",
    name: "Province",
    tag: "Provincial Rollout",
    price: "From £2k/mo",
    subPrice: "+ £35 per lodge, typically £4,500/mo",
    description:
      "Province-wide rollout, central oversight, migration planning, and ongoing support.",
    cta: "Talk to us",
    featureGroups: [
      {
        title: "Everything in Complete, plus:",
        items: [
          "Operator console",
          "Province-wide dashboards",
          "Annual returns CSV (one click)",
          "Bulk lodge operations",
          "Health-style portfolio signals",
          "Migration planning included",
          "Named provincial contact",
        ],
      },
    ],
    entitlements: [
      ...ESSENTIALS_ENTITLEMENTS,
      ...COMPLETE_EXTRA_ENTITLEMENTS,
      ...GROUP_EXTRA_ENTITLEMENTS,
      ...PROVINCE_EXTRA_ENTITLEMENTS,
    ],
  },
};

export function isPlanCode(value: string | null | undefined): value is PlanCode {
  return PLAN_CODES.includes(value as PlanCode);
}

export function normalizePlanCode(value: string | null | undefined): PlanCode {
  if (isPlanCode(value)) return value;
  if (value === "starter" || value === "single_lodge" || value === "single") {
    return "lodge_essentials";
  }
  if (value === "complete") return "lodge_complete";
  if (value === "group") return "lodge_group";
  return "lodge_essentials";
}

export function getPlanDefinition(value: string | null | undefined) {
  return PLAN_DEFINITIONS[normalizePlanCode(value)];
}

export function planIncludes(
  planCode: string | null | undefined,
  entitlement: EntitlementKey
) {
  return getPlanDefinition(planCode).entitlements.includes(entitlement);
}

export function entitlementsForPlan(planCode: string | null | undefined) {
  return Object.fromEntries(
    ENTITLEMENT_KEYS.map((key) => [key, planIncludes(planCode, key)])
  ) as Record<EntitlementKey, boolean>;
}

export function requiredPlanForEntitlement(entitlement: EntitlementKey) {
  return PLAN_CODES.find((planCode) =>
    PLAN_DEFINITIONS[planCode].entitlements.includes(entitlement)
  );
}
