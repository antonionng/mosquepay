import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { computeNextDuesForMember } from "@/lib/dues/next-due";
import type {
  DuesSchedule,
  GiftAidDeclaration,
  MemberDuesInstalment,
} from "@/lib/db/types";
import { MemberDetailClient } from "./member-detail-client";

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
    />
  );
}
