import type {
  Member,
  Newcomer,
  Event,
  Rsvp,
  Payment,
  Donation,
  GiftAidDeclaration,
  CharityCampaign,
  MemberGiving,
  Mosque,
  ServiceNoticeSend,
  ServiceCollection,
} from "@/lib/db/types";

export type SecretaryReport = {
  totalServices: number;
  upcomingServices: number;
  publishedServices: number;
  servicesWithNotice: number;
  totalNoticeSends: number;
  totalRsvps: number;
  attendingCeremony: number;
  attendingDining: number;
  apologies: number;
  membersMissingAddress: number;
  membersMissingDietary: number;
  serviceTable: Array<{
    id: string;
    title: string;
    date: string;
    rsvpCount: number;
    diningCount: number;
    ceremonyCount: number;
    noticeSent: number;
    published: boolean;
  }>;
};

export type GivingPaymentMethodBreakdown = {
  online_subscription: number;
  bacs: number;
  paid_in_full: number;
  fee_waived: number;
  unset: number;
  bacs_monthly_total: number;
  /** Sum of `amount` of giving rows in each bucket (paid status not
   *  considered — this is *expected* income by method).  */
  bacs_annual_expected: number;
  paid_in_full_total: number;
  fee_waived_total: number;
  online_subscription_expected: number;
  unset_outstanding_total: number;
};

export type TreasurerReport = {
  totalPaid: number;
  totalRefunded: number;
  unpaidGivingTotal: number;
  paidGivingTotal: number;
  diningIncome: number;
  serviceFees: number;
  guestTickets: number;
  charityFromPayments: number;
  givingGiftAidEligible: number;
  givingGiftAidReclaimable: number;
  givingPaymentMethodBreakdown: GivingPaymentMethodBreakdown;
  outstandingGiving: Array<{
    member_email: string;
    member_name: string | null;
    amount: number;
    period_end: string;
    status: string;
    giving_payment_method:
      | "online_subscription"
      | "bacs"
      | "paid_in_full"
      | "fee_waived"
      | null;
    bacs_monthly_amount: number | null;
  }>;
  reconciliation: Array<{
    id: string;
    user_name: string | null;
    total: number;
    refunded: number;
    status: string;
    completed_at: string | null;
    mooov_payment_id: string | null;
    stripe_payment_intent_id: string | null;
  }>;
};

export type CharityReport = {
  totalRaised: number;
  campaignCount: number;
  donationCount: number;
  giftAidReclaimable: number;
  gasdsEligible: number;
  gasdsReclaimable: number;
  consentGap: number;
  campaignSummary: Array<{
    id: string;
    name: string;
    status: string;
    target: number;
    raised: number;
    donations: number;
    pct: number;
  }>;
  donorHistory: Array<{
    name: string;
    email: string;
    total: number;
    donations: number;
    giftAid: boolean;
  }>;
  serviceCollections: Array<{
    eventId: string;
    eventTitle: string;
    total: number;
    count: number;
  }>;
};

export type RecruitmentReport = {
  totalNewcomers: number;
  newThisMonth: number;
  conversionRate: number;
  staleNewcomers: number;
  bySource: Array<{ source: string; count: number; converted: number }>;
  byStage: Array<{ stage: string; count: number; avgAgeDays: number }>;
  staleList: Array<{
    id: string;
    name: string;
    email: string;
    stage: string;
    daysSinceUpdate: number;
  }>;
};

export type OperatorReport = {
  totalMosques: number;
  activeMosques: number;
  inactiveMosques: number;
  mosqueRows: Array<{
    id: string;
    name: string;
    slug: string;
    healthScore: number;
    members: number;
    upcomingServices: number;
    paymentsLast30: number;
    risk: "ok" | "watch" | "at-risk";
  }>;
};

export function buildSecretaryReport({
  events,
  rsvpsByEvent,
  members,
  noticeSendsByEvent,
  hasNoticeByEvent,
}: {
  events: Event[];
  rsvpsByEvent: Map<string, Rsvp[]>;
  members: Member[];
  noticeSendsByEvent: Map<string, ServiceNoticeSend[]>;
  hasNoticeByEvent: Set<string>;
}): SecretaryReport {
  const now = new Date();
  const allRsvps = events.flatMap((e) => rsvpsByEvent.get(e.id) ?? []);
  return {
    totalServices: events.length,
    upcomingServices: events.filter((e) => new Date(e.event_date) >= now).length,
    publishedServices: events.filter((e) => e.published).length,
    servicesWithNotice: events.filter((e) => hasNoticeByEvent.has(e.id)).length,
    totalNoticeSends: events.reduce(
      (s, e) => s + (noticeSendsByEvent.get(e.id)?.length ?? 0),
      0
    ),
    totalRsvps: allRsvps.length,
    attendingCeremony: allRsvps.filter((r) => r.attending_ceremony).length,
    attendingDining: allRsvps.filter((r) => r.attending_dining).length,
    apologies: allRsvps.filter((r) => !r.attending_ceremony).length,
    membersMissingAddress: members.filter((m) => !m.address_line_1).length,
    membersMissingDietary: members.filter((m) => !m.dietary_requirements).length,
    serviceTable: events
      .slice()
      .sort(
        (a, b) =>
          new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
      )
      .slice(0, 30)
      .map((e) => {
        const rsvps = rsvpsByEvent.get(e.id) ?? [];
        return {
          id: e.id,
          title: e.title,
          date: e.event_date,
          rsvpCount: rsvps.length,
          diningCount: rsvps.filter((r) => r.attending_dining).length,
          ceremonyCount: rsvps.filter((r) => r.attending_ceremony).length,
          noticeSent: noticeSendsByEvent.get(e.id)?.length ?? 0,
          published: e.published,
        };
      }),
  };
}

const SUCCESSFUL_PAYMENT_STATUSES = new Set([
  "completed",
  "succeeded",
  "paid",
  "partially_refunded",
]);

export function isSuccessfulPaymentStatus(status: string): boolean {
  return SUCCESSFUL_PAYMENT_STATUSES.has(status);
}

export function buildTreasurerReport({
  payments,
  memberGiving,
}: {
  payments: Payment[];
  memberGiving: MemberGiving[];
}): TreasurerReport {
  const completed = payments.filter((p) => isSuccessfulPaymentStatus(p.status));
  const totalPaid = completed.reduce((s, p) => s + p.total_amount, 0);
  const totalRefunded = payments.reduce((s, p) => s + p.refund_amount, 0);
  return {
    totalPaid,
    totalRefunded,
    unpaidGivingTotal: memberGiving
      .filter((d) => d.status !== "paid" && d.status !== "waived")
      .reduce((s, d) => s + d.amount, 0),
    paidGivingTotal: memberGiving
      .filter((d) => d.status === "paid")
      .reduce((s, d) => s + d.amount, 0),
    diningIncome: completed.reduce((s, p) => s + p.dining_amount, 0),
    serviceFees: completed.reduce((s, p) => s + p.service_fee_amount, 0),
    guestTickets: completed.reduce((s, p) => s + p.guest_ticket_amount, 0),
    charityFromPayments: completed.reduce((s, p) => s + p.charity_amount, 0),
    givingGiftAidEligible: memberGiving
      .filter((d) => d.status === "paid" && d.gift_aid_status === "declared")
      .reduce((s, d) => s + d.gift_aid_eligible_amount, 0),
    givingGiftAidReclaimable: memberGiving
      .filter((d) => d.status === "paid" && d.gift_aid_status === "declared")
      .reduce((s, d) => s + d.gift_aid_eligible_amount * 0.25, 0),
    givingPaymentMethodBreakdown: (() => {
      const acc: GivingPaymentMethodBreakdown = {
        online_subscription: 0,
        bacs: 0,
        paid_in_full: 0,
        fee_waived: 0,
        unset: 0,
        bacs_monthly_total: 0,
        bacs_annual_expected: 0,
        paid_in_full_total: 0,
        fee_waived_total: 0,
        online_subscription_expected: 0,
        unset_outstanding_total: 0,
      };
      for (const d of memberGiving) {
        // Skip advances so we don't double-count next-year rows.
        if (d.is_advance) continue;
        const method = d.giving_payment_method ?? null;
        if (method === "online_subscription") {
          acc.online_subscription += 1;
          acc.online_subscription_expected += Number(d.amount) || 0;
        } else if (method === "bacs") {
          acc.bacs += 1;
          acc.bacs_annual_expected += Number(d.amount) || 0;
          if (d.bacs_monthly_amount != null) {
            acc.bacs_monthly_total += Number(d.bacs_monthly_amount) || 0;
          }
        } else if (method === "paid_in_full") {
          acc.paid_in_full += 1;
          acc.paid_in_full_total += Number(d.amount) || 0;
        } else if (method === "fee_waived") {
          acc.fee_waived += 1;
          acc.fee_waived_total += Number(d.amount) || 0;
        } else {
          acc.unset += 1;
          if (d.status !== "paid" && d.status !== "waived") {
            acc.unset_outstanding_total += Number(d.amount) || 0;
          }
        }
      }
      return acc;
    })(),
    outstandingGiving: memberGiving
      .filter((d) => d.status !== "paid" && d.status !== "waived")
      .slice(0, 50)
      .map((d) => ({
        member_email: d.member_email,
        member_name: d.member_name,
        amount: d.amount,
        period_end: d.period_end,
        status: d.status,
        giving_payment_method: d.giving_payment_method ?? null,
        bacs_monthly_amount:
          d.bacs_monthly_amount != null ? Number(d.bacs_monthly_amount) : null,
      })),
    reconciliation: payments.slice(0, 50).map((p) => ({
      id: p.id,
      user_name: p.user_name,
      total: p.total_amount,
      refunded: p.refund_amount,
      status: p.status,
      completed_at: p.completed_at,
      mooov_payment_id: p.mooov_payment_id ?? null,
      stripe_payment_intent_id: p.stripe_payment_intent_id,
    })),
  };
}

export function buildCharityReport({
  campaigns,
  donations,
  giftAid,
  events,
  serviceCollections = [],
}: {
  campaigns: CharityCampaign[];
  donations: Donation[];
  giftAid: GiftAidDeclaration[];
  events: Event[];
  serviceCollections?: ServiceCollection[];
}): CharityReport {
  const eventTitleMap = new Map(events.map((e) => [e.id, e.title] as const));
  const giftAidEmails = new Set(
    giftAid.filter((g) => !g.revoked_at).map((g) => g.donor_email.toLowerCase())
  );
  const totalRaised = donations
    .filter((d) => isSuccessfulPaymentStatus(d.status))
    .reduce((s, d) => s + d.amount, 0);
  const eligible = donations.reduce((s, d) => {
    const declared =
      d.gift_aid_status === "declared" ||
      giftAidEmails.has(d.donor_email.toLowerCase());
    return declared ? s + d.amount : s;
  }, 0);

  const donorMap = new Map<
    string,
    { name: string; email: string; total: number; donations: number; giftAid: boolean }
  >();
  for (const d of donations) {
    const key = d.donor_email.toLowerCase();
    const cur =
      donorMap.get(key) ??
      {
        name: d.donor_name ?? "Anonymous",
        email: d.donor_email,
        total: 0,
        donations: 0,
        giftAid: false,
      };
    cur.total += d.amount;
    cur.donations += 1;
    if (giftAidEmails.has(key) || d.gift_aid_status === "declared") cur.giftAid = true;
    donorMap.set(key, cur);
  }
  const donorHistory = Array.from(donorMap.values()).sort(
    (a, b) => b.total - a.total
  );
  const consentGap = donorHistory.filter((d) => !d.giftAid).length;
  const gasdsEligible = serviceCollections.reduce(
    (sum, collection) => sum + collection.gasds_eligible_amount,
    0
  );

  const collectionsMap = new Map<
    string,
    { eventId: string; eventTitle: string; total: number; count: number }
  >();
  for (const d of donations) {
    if (!d.event_id) continue;
    const cur =
      collectionsMap.get(d.event_id) ??
      {
        eventId: d.event_id,
        eventTitle: eventTitleMap.get(d.event_id) ?? "Service",
        total: 0,
        count: 0,
      };
    cur.total += d.amount;
    cur.count += 1;
    collectionsMap.set(d.event_id, cur);
  }

  return {
    totalRaised,
    campaignCount: campaigns.length,
    donationCount: donations.length,
    giftAidReclaimable: eligible * 0.25,
    gasdsEligible,
    gasdsReclaimable: Math.min(gasdsEligible, 8000) * 0.25,
    consentGap,
    campaignSummary: campaigns.map((c) => {
      const ds = donations.filter((d) => d.campaign_id === c.id);
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        target: c.target_amount,
        raised: c.raised_amount,
        donations: ds.length,
        pct: Math.min(100, Math.round((c.raised_amount / Math.max(c.target_amount, 1)) * 100)),
      };
    }),
    donorHistory: donorHistory.slice(0, 50),
    serviceCollections: Array.from(collectionsMap.values()).sort(
      (a, b) => b.total - a.total
    ),
  };
}

export function buildRecruitmentReport({
  newcomers,
}: {
  newcomers: Newcomer[];
}): RecruitmentReport {
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = newcomers.filter(
    (l) => new Date(l.created_at).getTime() >= monthAgo
  ).length;
  const converted = newcomers.filter((l) => l.converted_member_id).length;
  const stale = newcomers.filter((l) => {
    if (l.converted_member_id) return false;
    const updated = new Date(l.updated_at).getTime();
    return now - updated > 30 * 24 * 60 * 60 * 1000;
  });

  const bySourceMap = new Map<
    string,
    { source: string; count: number; converted: number }
  >();
  for (const l of newcomers) {
    const src = l.source ?? "unknown";
    const cur = bySourceMap.get(src) ?? { source: src, count: 0, converted: 0 };
    cur.count += 1;
    if (l.converted_member_id) cur.converted += 1;
    bySourceMap.set(src, cur);
  }

  const byStageMap = new Map<
    string,
    { stage: string; count: number; totalAge: number }
  >();
  for (const l of newcomers) {
    const cur = byStageMap.get(l.stage) ?? {
      stage: l.stage,
      count: 0,
      totalAge: 0,
    };
    cur.count += 1;
    cur.totalAge +=
      (now - new Date(l.stage_changed_at ?? l.created_at).getTime()) /
      (1000 * 60 * 60 * 24);
    byStageMap.set(l.stage, cur);
  }

  return {
    totalNewcomers: newcomers.length,
    newThisMonth,
    conversionRate: newcomers.length === 0 ? 0 : Math.round((converted / newcomers.length) * 100),
    staleNewcomers: stale.length,
    bySource: Array.from(bySourceMap.values()).sort((a, b) => b.count - a.count),
    byStage: Array.from(byStageMap.values()).map((s) => ({
      stage: s.stage,
      count: s.count,
      avgAgeDays: Math.round(s.totalAge / Math.max(s.count, 1)),
    })),
    staleList: stale.slice(0, 50).map((l) => ({
      id: l.id,
      name: `${l.first_name} ${l.last_name}`.trim(),
      email: l.email,
      stage: l.stage,
      daysSinceUpdate: Math.floor(
        (now - new Date(l.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      ),
    })),
  };
}

export function buildOperatorReport({
  mosques,
  membersByMosque,
  upcomingByMosque,
  paymentsLast30ByMosque,
}: {
  mosques: Mosque[];
  membersByMosque: Map<string, number>;
  upcomingByMosque: Map<string, number>;
  paymentsLast30ByMosque: Map<string, number>;
}): OperatorReport {
  const mosqueRows = mosques.map((l) => {
    const members = membersByMosque.get(l.id) ?? 0;
    const upcoming = upcomingByMosque.get(l.id) ?? 0;
    const payments = paymentsLast30ByMosque.get(l.id) ?? 0;
    let healthScore = 0;
    if (l.is_active) healthScore += 30;
    if (members >= 10) healthScore += 25;
    else if (members >= 1) healthScore += 10;
    if (upcoming >= 1) healthScore += 25;
    if (payments >= 100) healthScore += 20;
    else if (payments >= 1) healthScore += 10;
    let risk: "ok" | "watch" | "at-risk" = "ok";
    if (healthScore < 40) risk = "at-risk";
    else if (healthScore < 70) risk = "watch";
    return {
      id: l.id,
      name: l.name,
      slug: l.slug,
      healthScore,
      members,
      upcomingServices: upcoming,
      paymentsLast30: payments,
      risk,
    };
  });
  return {
    totalMosques: mosques.length,
    activeMosques: mosques.filter((l) => l.is_active).length,
    inactiveMosques: mosques.filter((l) => !l.is_active).length,
    mosqueRows: mosqueRows.sort((a, b) => b.healthScore - a.healthScore),
  };
}

// ---------------------------------------------------------------------------
// Membership Annual Return
// ---------------------------------------------------------------------------
//
// A mosque-level membership return in the shape a Secretary needs for the
// UGLE / Network annual return: a roll of every member with their craft
// discipleship dates and current standing, plus the movements (memberships,
// passings, raisings, resignations, exclusions) inside the reporting year.
//
// The reporting year is the mosque/return year, configurable via
// `yearStartMonth` (1-12, default September = 9), so figures align with the
// mosque's return cadence rather than the calendar year.

export type AnnualReturnMemberRow = {
  id: string;
  name: string;
  email: string;
  rank: string | null;
  office: string | null;
  status: Member["membership_status"];
  royalArch: boolean;
  honorary: boolean;
  dateOfInitiation: string | null;
  dateOfPassing: string | null;
  dateOfRaising: string | null;
  age: number | null;
};

export type AnnualReturn = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  totalMembers: number;
  active: number;
  suspended: number;
  resigned: number;
  excluded: number;
  royalArch: number;
  honorary: number;
  averageAge: number | null;
  membershipsInYear: number;
  passingsInYear: number;
  raisingsInYear: number;
  members: AnnualReturnMemberRow[];
};

function ageFromDob(dob: string | null, asOf: Date): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = asOf.getFullYear() - d.getFullYear();
  const m = asOf.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && asOf.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

export function buildAnnualReturn({
  members,
  now = new Date(),
  yearStartMonth = 9,
}: {
  members: Member[];
  now?: Date;
  yearStartMonth?: number;
}): AnnualReturn {
  // Determine the current return year window. If we're before the start
  // month, the year began last calendar year.
  const startMonthIdx = Math.min(12, Math.max(1, yearStartMonth)) - 1;
  const startYear =
    now.getMonth() >= startMonthIdx
      ? now.getFullYear()
      : now.getFullYear() - 1;
  const periodStart = new Date(startYear, startMonthIdx, 1);
  const periodEnd = new Date(startYear + 1, startMonthIdx, 1);
  const inYear = (value: string | null): boolean => {
    if (!value) return false;
    const t = new Date(value).getTime();
    if (Number.isNaN(t)) return false;
    return t >= periodStart.getTime() && t < periodEnd.getTime();
  };

  const rows: AnnualReturnMemberRow[] = members.map((m) => ({
    id: m.id,
    name: m.full_name,
    email: m.email,
    rank: m.rank,
    office: m.office_title,
    status: m.membership_status,
    royalArch: Boolean(m.royal_arch),
    honorary: Boolean(m.honorary),
    dateOfInitiation: m.date_of_membership,
    dateOfPassing: m.date_of_passing,
    dateOfRaising: m.date_of_raising,
    age: ageFromDob(m.date_of_birth, now),
  }));

  const ages = rows
    .map((r) => r.age)
    .filter((a): a is number => typeof a === "number");
  const averageAge =
    ages.length > 0
      ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length)
      : null;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });

  return {
    periodLabel: `${fmt(periodStart)} – ${fmt(new Date(periodEnd.getTime() - 1))}`,
    periodStart: periodStart.toISOString().slice(0, 10),
    periodEnd: periodEnd.toISOString().slice(0, 10),
    totalMembers: members.length,
    active: members.filter((m) => m.membership_status === "active").length,
    suspended: members.filter((m) => m.membership_status === "suspended").length,
    resigned: members.filter((m) => m.membership_status === "resigned").length,
    excluded: members.filter((m) => m.membership_status === "excluded").length,
    royalArch: members.filter((m) => m.royal_arch).length,
    honorary: members.filter((m) => m.honorary).length,
    averageAge,
    membershipsInYear: members.filter((m) => inYear(m.date_of_membership)).length,
    passingsInYear: members.filter((m) => inYear(m.date_of_passing)).length,
    raisingsInYear: members.filter((m) => inYear(m.date_of_raising)).length,
    members: rows.sort((a, b) => a.name.localeCompare(b.name)),
  };
}
