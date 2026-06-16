import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { computeNextGivingForMember } from "@/lib/giving/next-due";
import { sweepAbandonedPendingSchedules } from "@/lib/giving/abandoned-pending-sweep";
import { getDefaultMosqueSlug } from "@/lib/tenant";
import type {
  GivingSchedule,
  GiftAidDeclaration,
  MemberGiving,
  MemberGivingInstalment,
} from "@/lib/db/types";
import { MemberDetailClient } from "./member-detail-client";

function pickCurrentYearGiving(
  givingRecords: MemberGiving[],
  yearStartIso: string | null,
  yearEndIso: string | null,
): MemberGiving | null {
  const nonAdvance = givingRecords.filter((d) => !d.is_advance);
  if (nonAdvance.length === 0) return null;
  if (yearStartIso && yearEndIso) {
    const ys = yearStartIso.slice(0, 10);
    const ye = yearEndIso.slice(0, 10);
    const inYear = nonAdvance.find(
      (d) =>
        d.period_start.slice(0, 10) <= ye &&
        d.period_end.slice(0, 10) >= ys,
    );
    if (inYear) return inYear;
  }
  return [...nonAdvance].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
}

export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  if (useMock) {
    const member = mockDb.getMemberById(id);
    if (!member) notFound();

    const dietaryHistory = mockDb.getRsvpDietaryByEmail(member.email);
    const paymentHistory = mockDb.getPaymentsByEmail(member.email);

    return (
      <MemberDetailClient
        member={JSON.parse(JSON.stringify(member))}
        dietaryHistory={JSON.parse(JSON.stringify(dietaryHistory))}
        paymentHistory={JSON.parse(JSON.stringify(paymentHistory))}
        givingRecords={[]}
        nextGiving={null}
        subscription={null}
        giftAidDeclaration={null}
        givingMethod={null}
      />
    );
  }

  if (!mosqueId) notFound();

  const member = await db.getMemberById(id, mosqueId);
  if (!member) notFound();

  // Self-heal stale pending schedules from abandoned Mooov checkouts
  // before we read this member's subscription history.
  await sweepAbandonedPendingSchedules(mosqueId).catch(() => 0);

  const [
    dietaryHistory,
    paymentHistory,
    givingRecords,
    offices,
    currentYear,
    mosqueGiving,
    schedules,
    giftAidDeclaration,
    recentEmails,
  ] = await Promise.all([
    db.getRsvpDietaryByEmail(member.email, mosqueId),
    db.getPaymentsByEmail(member.email, mosqueId),
    db.getMemberGiving(mosqueId, { memberEmail: member.email }),
    db.listOfficerLadder(mosqueId),
    db.getCurrentMosqueYear(mosqueId),
    db.getMosqueGiving(mosqueId),
    db.getGivingSchedulesForMember(mosqueId, member.email),
    // Seed the Gift Aid panel with the active declaration. The panel
    // re-fetches on mount so an upload from another tab will update; the
    // server seed just avoids the empty-flash on first paint.
    db.getActiveGiftAidDeclarationByMember(mosqueId, {
      id: member.id,
      email: member.email,
    }),
    // The "Recent emails" panel reads append-only sends from
    // public.email_log (migration 064). Empty list = no sends yet,
    // not an error.
    db.listEmailLogForMember(mosqueId, member.email, 10).catch(() => []),
  ]);

  const nextGiving = computeNextGivingForMember({
    currentYear,
    memberGiving: givingRecords,
    defaultAnnualAmount:
      currentYear?.annual_giving_amount ?? mosqueGiving[0]?.amount ?? null,
    annualGivingWaived: member.annual_giving_waived === true,
    annualGivingWaiverReason: member.annual_giving_waiver_reason ?? null,
  });

  // Pick the most relevant subscription for the panel: prefer any
  // active/needs-attention schedule over completed/cancelled history.
  // Returned schedules from db.getGivingSchedulesForMember are already
  // ordered created_at DESC.
  const subscriptionPriority: Record<string, number> = {
    action_required: 0,
    past_due: 1,
    paused: 2,
    pending: 3,
    active: 4,
    active_stripe: 5,
    completed: 6,
    cancelled: 7,
  };
  // `cancelled_at` is the source of truth — late webhooks could
  // historically clobber a cancelled row's status, so treat any row
  // with cancelled_at set as cancelled when prioritising.
  const effectiveSchedules = schedules.map((s) => ({
    ...s,
    status: s.cancelled_at != null ? "cancelled" : s.status,
  }));
  const activeSchedule = [...effectiveSchedules].sort(
    (a, b) =>
      (subscriptionPriority[a.status] ?? 99) -
      (subscriptionPriority[b.status] ?? 99)
  )[0] as GivingSchedule | undefined;

  let subscription:
    | {
        schedule: GivingSchedule;
        instalments: MemberGivingInstalment[];
      }
    | null = null;
  // Only render the subscription panel for genuinely live schedules.
  // Cancelled/completed history is still visible elsewhere; this panel
  // is for "is the member currently on an active subscription?".
  const hasLiveSchedule =
    activeSchedule != null &&
    activeSchedule.cancelled_at == null &&
    activeSchedule.status !== "cancelled" &&
    activeSchedule.status !== "completed";
  if (activeSchedule && hasLiveSchedule) {
    const instalments = await db.getInstalmentsForGiving(
      activeSchedule.member_giving_id,
      mosqueId
    );
    subscription = { schedule: activeSchedule, instalments };
  }

  // Pick the giving row that drives the new "Giving payment method" panel.
  // Same row-resolution logic the API uses so the panel reflects what
  // the POST handler will mutate.
  const givingRowForMethod = pickCurrentYearGiving(
    givingRecords,
    currentYear?.start_date ?? null,
    currentYear?.end_date ?? null,
  );

  // Build the public subscription/pay link the admin can copy or
  // mailto. Same shape as the membership cron template:
  // ${siteUrl}/giving/[givingId]?email=...&mosque=...
  let subscriptionLink: string | null = null;
  if (givingRowForMethod) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const mosqueSlug = ctx.mode === "database" ? ctx.mosqueSlug : null;
    if (siteUrl) {
      const u = new URL(`/giving/${givingRowForMethod.id}`, siteUrl);
      u.searchParams.set("email", member.email);
      if (mosqueSlug && mosqueSlug !== getDefaultMosqueSlug()) {
        u.searchParams.set("mosque", mosqueSlug);
      }
      subscriptionLink = u.toString();
    }
  }

  const givingMethod = givingRowForMethod
    ? {
        givingId: givingRowForMethod.id,
        method: givingRowForMethod.giving_payment_method ?? null,
        bacsMonthlyAmount: givingRowForMethod.bacs_monthly_amount ?? null,
        bacsReference: givingRowForMethod.bacs_reference ?? null,
        waiverReason: givingRowForMethod.waiver_reason ?? null,
        paidAt: givingRowForMethod.paid_at ?? null,
        setBy: givingRowForMethod.payment_method_set_by ?? null,
        setAt: givingRowForMethod.payment_method_set_at ?? null,
        annualAmount:
          givingRowForMethod.full_year_amount ?? givingRowForMethod.amount,
        yearLabel: currentYear?.label ?? null,
        subscriptionLink,
        hasActiveSubscription: subscription != null,
      }
    : {
        givingId: null,
        method: null,
        bacsMonthlyAmount: null,
        bacsReference: null,
        waiverReason: null,
        paidAt: null,
        setBy: null,
        setAt: null,
        annualAmount: null,
        yearLabel: currentYear?.label ?? null,
        subscriptionLink: null,
        hasActiveSubscription: subscription != null,
      };

  return (
    <MemberDetailClient
      member={JSON.parse(JSON.stringify(member))}
      dietaryHistory={JSON.parse(JSON.stringify(dietaryHistory))}
      paymentHistory={JSON.parse(JSON.stringify(paymentHistory))}
      givingRecords={JSON.parse(JSON.stringify(givingRecords))}
      offices={JSON.parse(JSON.stringify(offices))}
      nextGiving={nextGiving ? JSON.parse(JSON.stringify(nextGiving)) : null}
      subscription={
        subscription ? JSON.parse(JSON.stringify(subscription)) : null
      }
      giftAidDeclaration={
        giftAidDeclaration
          ? (JSON.parse(
              JSON.stringify(giftAidDeclaration),
            ) as GiftAidDeclaration)
          : null
      }
      givingMethod={JSON.parse(JSON.stringify(givingMethod))}
      recentEmails={JSON.parse(JSON.stringify(recentEmails))}
    />
  );
}
