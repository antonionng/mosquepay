import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { computeNextDuesForMember } from "@/lib/dues/next-due";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ year: null, members: [] });
  }

  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", lodgeId);
  if (forbidden) return forbidden;

  const [members, allDues, currentYear, lodgeDues] = await Promise.all([
    db.getMembers(lodgeId, { status: "active" }),
    db.getMemberDues(lodgeId),
    db.getCurrentMasonicYear(lodgeId),
    db.getLodgeDues(lodgeId),
  ]);

  const defaultAmount =
    currentYear?.annual_dues_amount ?? lodgeDues[0]?.amount ?? null;

  const duesByEmail = new Map<string, typeof allDues>();
  for (const dues of allDues) {
    const key = dues.member_email.toLowerCase();
    if (!duesByEmail.has(key)) duesByEmail.set(key, []);
    duesByEmail.get(key)!.push(dues);
  }

  const rows = members.map((member) => {
    const summary = computeNextDuesForMember({
      currentYear,
      memberDues: duesByEmail.get(member.email.toLowerCase()) ?? [],
      defaultAnnualAmount: defaultAmount,
      annualDuesWaived: member.annual_dues_waived === true,
      annualDuesWaiverReason: member.annual_dues_waiver_reason ?? null,
    });
    return {
      member_id: member.id,
      full_name: member.full_name,
      email: member.email,
      ...summary,
    };
  });

  rows.sort((a, b) => {
    const aDate = a.nextDueDate ?? "9999";
    const bDate = b.nextDueDate ?? "9999";
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return a.full_name.localeCompare(b.full_name);
  });

  return NextResponse.json({
    year: currentYear,
    default_amount: defaultAmount,
    members: rows,
  });
}
