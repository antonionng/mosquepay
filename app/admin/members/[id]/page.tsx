import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
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
      />
    );
  }

  if (!lodgeId) notFound();

  const member = await db.getMemberById(id, lodgeId);
  if (!member) notFound();

  const [dietaryHistory, paymentHistory, duesRecords, offices] = await Promise.all([
    db.getRsvpDietaryByEmail(member.email, lodgeId),
    db.getPaymentsByEmail(member.email, lodgeId),
    db.getMemberDues(lodgeId, { memberEmail: member.email }),
    db.listOfficerLadder(lodgeId),
  ]);

  return (
    <MemberDetailClient
      member={JSON.parse(JSON.stringify(member))}
      dietaryHistory={JSON.parse(JSON.stringify(dietaryHistory))}
      paymentHistory={JSON.parse(JSON.stringify(paymentHistory))}
      duesRecords={JSON.parse(JSON.stringify(duesRecords))}
      offices={JSON.parse(JSON.stringify(offices))}
    />
  );
}
