import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { computeNextDuesForMember } from "@/lib/dues/next-due";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import type {
  DuesSchedule,
  GiftAidDeclaration,
  MemberDues,
  MemberDuesInstalment,
} from "@/lib/db/types";
import { MemberDetailClient } from "./member-detail-client";

function pickCurrentYearDues(
  duesRecords: MemberDues[],
  yearStartIso: string | null,
  yearEndIso: string | null,
): MemberDues | null {
  const nonAdvance = duesRecords.filter((d) => !d.is_advance);
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
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

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
        duesRecords={[]}
        nextDues={null}
        subscription={null}
        giftAidDeclaration={null}
        duesMethod={null}
      />
    );
  }

  if (!lodgeId) notFound();

  const member = await db.getMemberById(id, lodgeId);
  if (!member) notFound();

  const [
    dietaryHistory,
    paymentHistory,
    duesRecords,
    offices,
    currentYear,
    lodgeDues,
    schedules,
    giftAidDeclaration,
  ] = await Promise.all([
    db.getRsvpDietaryByEmail(member.email, lodgeId),
    db.getPaymentsByEmail(member.email, lodgeId),
    db.getMemberDues(lodgeId, { memberEmail: member.email }),
    db.listOfficerLadder(lodgeId),
    db.getCurrentMasonicYear(lodgeId),
    db.getLodgeDues(lodgeId),
    db.getDuesSchedulesForMember(lodgeId, member.email),
    // Seed the Gift Aid panel with the active declaration. The panel
    // re-fetches on mount so an upload from another tab will update; the
    // server seed just avoids the empty-flash on first paint.
    db.getActiveGiftAidDeclarationByMember(lodgeId, {
      id: member.id,
      email: member.email,
    }),
  ]);

  const nextDues = computeNextDuesForMember({
    currentYear,
    memberDues: duesRecords,
    defaultAnnualAmount:
      currentYear?.annual_dues_amount ?? lodgeDues[0]?.amount ?? null,
    annualDuesWaived: member.annual_dues_waived === true,
    annualDuesWaiverReason: member.annual_dues_waiver_reason ?? null,
  });

  // Pick the most relevant subscription for the panel: prefer any
  // active/needs-attention schedule over completed/cancelled history.
  // Returned schedules from db.getDuesSchedulesForMember are already
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
  const activeSchedule = [...schedules].sort(
    (a, b) =>
      (subscriptionPriority[a.status] ?? 99) -
      (subscriptionPriority[b.status] ?? 99)
  )[0] as DuesSchedule | undefined;

  let subscription:
    | {
        schedule: DuesSchedule;
        instalments: MemberDuesInstalment[];
      }
    | null = null;
  if (activeSchedule) {
    const instalments = await db.getInstalmentsForDues(
      activeSchedule.member_dues_id,
      lodgeId
    );
    subscription = { schedule: activeSchedule, instalments };
  }

  // Pick the dues row that drives the new "Dues payment method" panel.
  // Same row-resolution logic the API uses so the panel reflects what
  // the POST handler will mutate.
  const duesRowForMethod = pickCurrentYearDues(
    duesRecords,
    currentYear?.start_date ?? null,
    currentYear?.end_date ?? null,
  );

  // Build the public subscription/pay link the admin can copy or
  // mailto. Same shape as the initiation cron template:
  // ${siteUrl}/dues/[duesId]?email=...&lodge=...
  let subscriptionLink: string | null = null;
  if (duesRowForMethod) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const lodgeSlug = ctx.mode === "database" ? ctx.lodgeSlug : null;
    if (siteUrl) {
      const u = new URL(`/dues/${duesRowForMethod.id}`, siteUrl);
      u.searchParams.set("email", member.email);
      if (lodgeSlug && lodgeSlug !== getDefaultLodgeSlug()) {
        u.searchParams.set("lodge", lodgeSlug);
      }
      subscriptionLink = u.toString();
    }
  }

  const duesMethod = duesRowForMethod
    ? {
        duesId: duesRowForMethod.id,
        method: duesRowForMethod.dues_payment_method ?? null,
        bacsMonthlyAmount: duesRowForMethod.bacs_monthly_amount ?? null,
        bacsReference: duesRowForMethod.bacs_reference ?? null,
        waiverReason: duesRowForMethod.waiver_reason ?? null,
        paidAt: duesRowForMethod.paid_at ?? null,
        setBy: duesRowForMethod.payment_method_set_by ?? null,
        setAt: duesRowForMethod.payment_method_set_at ?? null,
        annualAmount:
          duesRowForMethod.full_year_amount ?? duesRowForMethod.amount,
        yearLabel: currentYear?.label ?? null,
        subscriptionLink,
        hasActiveSubscription: subscription != null,
      }
    : {
        duesId: null,
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
      duesRecords={JSON.parse(JSON.stringify(duesRecords))}
      offices={JSON.parse(JSON.stringify(offices))}
      nextDues={nextDues ? JSON.parse(JSON.stringify(nextDues)) : null}
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
      duesMethod={JSON.parse(JSON.stringify(duesMethod))}
    />
  );
}
