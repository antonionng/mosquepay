import type {
  Member,
  Lead,
  Event,
  Rsvp,
  Payment,
  Donation,
  GiftAidDeclaration,
  CharityCampaign,
  MemberDues,
  Lodge,
  EventSummonsSend,
} from "@/lib/db/types";

export type SecretaryReport = {
  totalMeetings: number;
  upcomingMeetings: number;
  publishedMeetings: number;
  meetingsWithSummons: number;
  totalSummonsSends: number;
  totalRsvps: number;
  attendingCeremony: number;
  attendingDining: number;
  apologies: number;
  membersMissingAddress: number;
  membersMissingDietary: number;
  meetingTable: Array<{
    id: string;
    title: string;
    date: string;
    rsvpCount: number;
    diningCount: number;
    ceremonyCount: number;
    summonsSent: number;
    published: boolean;
  }>;
};

export type TreasurerReport = {
  totalPaid: number;
  totalRefunded: number;
  unpaidDuesTotal: number;
  paidDuesTotal: number;
  diningIncome: number;
  meetingFees: number;
  guestTickets: number;
  charityFromPayments: number;
  outstandingDues: Array<{
    member_email: string;
    member_name: string | null;
    amount: number;
    period_end: string;
    status: string;
  }>;
  reconciliation: Array<{
    id: string;
    user_name: string | null;
    total: number;
    refunded: number;
    status: string;
    completed_at: string | null;
    stripe_payment_intent_id: string | null;
  }>;
};

export type CharityReport = {
  totalRaised: number;
  campaignCount: number;
  donationCount: number;
  giftAidReclaimable: number;
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
  meetingCollections: Array<{
    eventId: string;
    eventTitle: string;
    total: number;
    count: number;
  }>;
};

export type RecruitmentReport = {
  totalLeads: number;
  newThisMonth: number;
  conversionRate: number;
  staleLeads: number;
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
  totalLodges: number;
  activeLodges: number;
  inactiveLodges: number;
  lodgeRows: Array<{
    id: string;
    name: string;
    slug: string;
    healthScore: number;
    members: number;
    upcomingMeetings: number;
    paymentsLast30: number;
    risk: "ok" | "watch" | "at-risk";
  }>;
};

export function buildSecretaryReport({
  events,
  rsvpsByEvent,
  members,
  summonsSendsByEvent,
  hasSummonsByEvent,
}: {
  events: Event[];
  rsvpsByEvent: Map<string, Rsvp[]>;
  members: Member[];
  summonsSendsByEvent: Map<string, EventSummonsSend[]>;
  hasSummonsByEvent: Set<string>;
}): SecretaryReport {
  const now = new Date();
  const allRsvps = events.flatMap((e) => rsvpsByEvent.get(e.id) ?? []);
  return {
    totalMeetings: events.length,
    upcomingMeetings: events.filter((e) => new Date(e.event_date) >= now).length,
    publishedMeetings: events.filter((e) => e.published).length,
    meetingsWithSummons: events.filter((e) => hasSummonsByEvent.has(e.id)).length,
    totalSummonsSends: events.reduce(
      (s, e) => s + (summonsSendsByEvent.get(e.id)?.length ?? 0),
      0
    ),
    totalRsvps: allRsvps.length,
    attendingCeremony: allRsvps.filter((r) => r.attending_ceremony).length,
    attendingDining: allRsvps.filter((r) => r.attending_dining).length,
    apologies: allRsvps.filter((r) => !r.attending_ceremony).length,
    membersMissingAddress: members.filter((m) => !m.address_line_1).length,
    membersMissingDietary: members.filter((m) => !m.dietary_requirements).length,
    meetingTable: events
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
          summonsSent: summonsSendsByEvent.get(e.id)?.length ?? 0,
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
  memberDues,
}: {
  payments: Payment[];
  memberDues: MemberDues[];
}): TreasurerReport {
  const completed = payments.filter((p) => isSuccessfulPaymentStatus(p.status));
  const totalPaid = completed.reduce((s, p) => s + p.total_amount, 0);
  const totalRefunded = payments.reduce((s, p) => s + p.refund_amount, 0);
  return {
    totalPaid,
    totalRefunded,
    unpaidDuesTotal: memberDues
      .filter((d) => d.status !== "paid" && d.status !== "waived")
      .reduce((s, d) => s + d.amount, 0),
    paidDuesTotal: memberDues
      .filter((d) => d.status === "paid")
      .reduce((s, d) => s + d.amount, 0),
    diningIncome: completed.reduce((s, p) => s + p.dining_amount, 0),
    meetingFees: completed.reduce((s, p) => s + p.meeting_fee_amount, 0),
    guestTickets: completed.reduce((s, p) => s + p.guest_ticket_amount, 0),
    charityFromPayments: completed.reduce((s, p) => s + p.charity_amount, 0),
    outstandingDues: memberDues
      .filter((d) => d.status !== "paid" && d.status !== "waived")
      .slice(0, 50)
      .map((d) => ({
        member_email: d.member_email,
        member_name: d.member_name,
        amount: d.amount,
        period_end: d.period_end,
        status: d.status,
      })),
    reconciliation: payments.slice(0, 50).map((p) => ({
      id: p.id,
      user_name: p.user_name,
      total: p.total_amount,
      refunded: p.refund_amount,
      status: p.status,
      completed_at: p.completed_at,
      stripe_payment_intent_id: p.stripe_payment_intent_id,
    })),
  };
}

export function buildCharityReport({
  campaigns,
  donations,
  giftAid,
  events,
}: {
  campaigns: CharityCampaign[];
  donations: Donation[];
  giftAid: GiftAidDeclaration[];
  events: Event[];
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
        eventTitle: eventTitleMap.get(d.event_id) ?? "Meeting",
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
    meetingCollections: Array.from(collectionsMap.values()).sort(
      (a, b) => b.total - a.total
    ),
  };
}

export function buildRecruitmentReport({
  leads,
}: {
  leads: Lead[];
}): RecruitmentReport {
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const newThisMonth = leads.filter(
    (l) => new Date(l.created_at).getTime() >= monthAgo
  ).length;
  const converted = leads.filter((l) => l.converted_member_id).length;
  const stale = leads.filter((l) => {
    if (l.converted_member_id) return false;
    const updated = new Date(l.updated_at).getTime();
    return now - updated > 30 * 24 * 60 * 60 * 1000;
  });

  const bySourceMap = new Map<
    string,
    { source: string; count: number; converted: number }
  >();
  for (const l of leads) {
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
  for (const l of leads) {
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
    totalLeads: leads.length,
    newThisMonth,
    conversionRate: leads.length === 0 ? 0 : Math.round((converted / leads.length) * 100),
    staleLeads: stale.length,
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
  lodges,
  membersByLodge,
  upcomingByLodge,
  paymentsLast30ByLodge,
}: {
  lodges: Lodge[];
  membersByLodge: Map<string, number>;
  upcomingByLodge: Map<string, number>;
  paymentsLast30ByLodge: Map<string, number>;
}): OperatorReport {
  const lodgeRows = lodges.map((l) => {
    const members = membersByLodge.get(l.id) ?? 0;
    const upcoming = upcomingByLodge.get(l.id) ?? 0;
    const payments = paymentsLast30ByLodge.get(l.id) ?? 0;
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
      upcomingMeetings: upcoming,
      paymentsLast30: payments,
      risk,
    };
  });
  return {
    totalLodges: lodges.length,
    activeLodges: lodges.filter((l) => l.is_active).length,
    inactiveLodges: lodges.filter((l) => !l.is_active).length,
    lodgeRows: lodgeRows.sort((a, b) => b.healthScore - a.healthScore),
  };
}
