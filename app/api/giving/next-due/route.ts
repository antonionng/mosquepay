import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { computeNextGivingForMember } from "@/lib/giving/next-due";

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ year: null, members: [] });
  }

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("payments:write", mosqueId);
  if (forbidden) return forbidden;

  const [members, allGiving, currentYear, mosqueGiving] = await Promise.all([
    db.getMembers(mosqueId, { status: "active" }),
    db.getMemberGiving(mosqueId),
    db.getCurrentMosqueYear(mosqueId),
    db.getMosqueGiving(mosqueId),
  ]);

  const defaultAmount =
    currentYear?.annual_giving_amount ?? mosqueGiving[0]?.amount ?? null;

  const givingByEmail = new Map<string, typeof allGiving>();
  for (const giving of allGiving) {
    const key = giving.member_email.toLowerCase();
    if (!givingByEmail.has(key)) givingByEmail.set(key, []);
    givingByEmail.get(key)!.push(giving);
  }

  const rows = members.map((member) => {
    const summary = computeNextGivingForMember({
      currentYear,
      memberGiving: givingByEmail.get(member.email.toLowerCase()) ?? [],
      defaultAnnualAmount: defaultAmount,
      annualGivingWaived: member.annual_giving_waived === true,
      annualGivingWaiverReason: member.annual_giving_waiver_reason ?? null,
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
