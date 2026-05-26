import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { computeNextDuesForMember } from "@/lib/dues/next-due";
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
  ] = await Promise.all([
    db.getRsvpDietaryByEmail(member.email, lodgeId),
    db.getPaymentsByEmail(member.email, lodgeId),
    db.getMemberDues(lodgeId, { memberEmail: member.email }),
    db.listOfficerLadder(lodgeId),
    db.getCurrentMasonicYear(lodgeId),
    db.getLodgeDues(lodgeId),
  ]);

  const nextDues = computeNextDuesForMember({
    currentYear,
    memberDues: duesRecords,
    defaultAnnualAmount:
      currentYear?.annual_dues_amount ?? lodgeDues[0]?.amount ?? null,
    annualDuesWaived: member.annual_dues_waived === true,
    annualDuesWaiverReason: member.annual_dues_waiver_reason ?? null,
  });

  return (
    <MemberDetailClient
      member={JSON.parse(JSON.stringify(member))}
      dietaryHistory={JSON.parse(JSON.stringify(dietaryHistory))}
      paymentHistory={JSON.parse(JSON.stringify(paymentHistory))}
      duesRecords={JSON.parse(JSON.stringify(duesRecords))}
      offices={JSON.parse(JSON.stringify(offices))}
      nextDues={nextDues ? JSON.parse(JSON.stringify(nextDues)) : null}
    />
  );
}
