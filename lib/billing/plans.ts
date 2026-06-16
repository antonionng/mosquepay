export const PLAN_CODES = [
  "mosque_essentials",
  "mosque_complete",
  "mosque_group",
  "network",
] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export const ENTITLEMENT_KEYS = [
  "site_builder",
  "member_portal",
  "digital_mosque_card",
  "payments",
  "giving",
  "gift_aid",
  "gasds",
  "services",
  "notice",
  "events",
  "treasurer_reports",
  "secretary_reports",
  "charity",
  "newcomer_crm",
  "pastoral_care",
  "charity_campaigns",
  "charity_reports",
  "recruitment_reports",
  "audit",
  "bulk_import",
  "advanced_members",
  "multi_mosque",
  "cross_mosque_reporting",
  "central_billing",
  "network_dashboards",
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
  "digital_mosque_card",
  "payments",
  "giving",
  "gift_aid",
  "gasds",
  "services",
  "notice",
  "events",
  "treasurer_reports",
  "secretary_reports",
  "charity",
  "guest_links",
  // The /admin/integrations page is the only UI surface that exposes
  // Mooov Connect (connect, reconnect, disconnect, repair). Mooov is the
  // payments rail and `payments` is already an Essentials entitlement, so
  // gating its setup UI to Network made it impossible for any paying
  // Essentials/Complete/Group mosque to actually administer their own
  // Mooov merchant. Calendar / email / accounting connectors on this
  // page are non-destructive (each one is its own toggle), so promoting
  // the page itself doesn't auto-enable a paid integration.
  "integrations",
];

const COMPLETE_EXTRA_ENTITLEMENTS: EntitlementKey[] = [
  "newcomer_crm",
  "pastoral_care",
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
  "multi_mosque",
  "cross_mosque_reporting",
  "central_billing",
];

const PROVINCE_EXTRA_ENTITLEMENTS: EntitlementKey[] = [
  "network_dashboards",
  "migration_planning",
  "named_support",
];

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  mosque_essentials: {
    code: "mosque_essentials",
    name: "Essentials",
    tag: "Single Mosque",
    price: "From £149/mo",
    subPrice: "billed annually, or £169 monthly",
    description:
      "Everything a mosque team needs to run the mosque, take payments, and reclaim every penny of Gift Aid the mosque is owed.",
    cta: "Get a walkthrough",
    upgradeTo: "mosque_complete",
    featureGroups: [
      {
        title: "The mosque, online",
        items: ["Public mosque website", "Member portal & PWA", "Digital mosque card"],
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
          "Gift Aid on giving & donations",
          "GASDS cash tracking",
          "HMRC-ready exports",
        ],
      },
      {
        title: "Services & giving",
        items: [
          "Service notice workflow",
          "RSVPs & dietary tracking",
          "Bulk giving & reminders",
        ],
      },
    ],
    entitlements: ESSENTIALS_ENTITLEMENTS,
  },
  mosque_complete: {
    code: "mosque_complete",
    name: "Complete",
    tag: "Most Mosques Choose This",
    price: "From £229/mo",
    subPrice: "billed annually, or £259 monthly",
    description:
      "Everything in Essentials, plus the AI assistant, newcomer pipeline, welfare, and full reporting suite.",
    cta: "Get a walkthrough",
    recommended: true,
    upgradeTo: "mosque_group",
    featureGroups: [
      {
        title: "Everything in Essentials, plus:",
        items: [
          "AI assistant for drafting",
          "Members-at-risk insights",
          "Post-service summaries",
          "Data quality checks",
        ],
      },
      {
        title: "Membership & care",
        items: [
          "Newcomer CRM & pipeline",
          "Welfare cases",
          "Discipleship mentoring",
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
  mosque_group: {
    code: "mosque_group",
    name: "Group",
    tag: "2 to 6 mosques",
    price: "From £349/mo",
    subPrice: "2 mosques, then £119 per extra",
    description:
      "Everything in Complete for halls, groups, or connected mosques with shared oversight and central billing.",
    cta: "Get a walkthrough",
    upgradeTo: "network",
    featureGroups: [
      {
        title: "Everything in Complete, plus:",
        items: [
          "Separate mosque records",
          "Per-mosque branding & site",
          "Cross-mosque reporting",
          "Central billing, one invoice",
          "Mosque context switching",
          "Multi-mosque member visibility",
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
  network: {
    code: "network",
    name: "Network",
    tag: "Network Rollout",
    price: "From £2k/mo",
    subPrice: "+ £35 per mosque, typically £4,500/mo",
    description:
      "Network-wide rollout, central oversight, migration planning, and ongoing support.",
    cta: "Talk to us",
    featureGroups: [
      {
        title: "Everything in Complete, plus:",
        items: [
          "Operator console",
          "Network-wide dashboards",
          "Annual returns CSV (one click)",
          "Bulk mosque operations",
          "Health-style portfolio signals",
          "Migration planning included",
          "Named network contact",
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
  if (value === "starter" || value === "single_mosque" || value === "single") {
    return "mosque_essentials";
  }
  if (value === "complete") return "mosque_complete";
  if (value === "group") return "mosque_group";
  return "mosque_essentials";
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
