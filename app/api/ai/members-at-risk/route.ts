import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

type RiskRow = {
  member_id: string;
  full_name: string;
  email: string;
  reasons: string[];
  score: number;
};

export async function GET(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ rows: [] });
  }
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:read", mosqueId);
  if (forbidden) return forbidden;

  const members = await db.getMembers(mosqueId, { status: "active" });
  const allGiving = await Promise.all(
    members.map((m) =>
      db.getMemberGiving(mosqueId, { memberEmail: m.email }).catch(() => [])
    )
  ).catch(() => []);
  const recentEvents = await db.getEvents(mosqueId, { upcoming: false });
  const past = recentEvents
    .filter((e) => new Date(e.event_date) < new Date())
    .slice(0, 5);
  const rsvpByEvent: Record<string, Awaited<ReturnType<typeof db.getRsvpsByEventId>>> = {};
  await Promise.all(
    past.map(async (e) => {
      rsvpByEvent[e.id] = await db.getRsvpsByEventId(e.id, mosqueId).catch(() => []);
    })
  );

  const rows: RiskRow[] = members.map((member, i) => {
    const reasons: string[] = [];
    let score = 0;
    const giving = (allGiving[i] ?? []) as Array<{ status: string }>;
    const overdue = giving.filter((d) => d.status === "overdue").length;
    if (overdue > 0) {
      reasons.push(`${overdue} overdue giving`);
      score += overdue * 2;
    }
    let attended = 0;
    let totalEligible = 0;
    for (const event of past) {
      const rsvp = rsvpByEvent[event.id]?.find(
        (r) => r.user_email === member.email
      );
      if (rsvp) {
        totalEligible++;
        if (rsvp.status === "yes") attended++;
      }
    }
    if (totalEligible >= 3 && attended === 0) {
      reasons.push("Missed last 3+ services");
      score += 3;
    }
    if (!member.phone) {
      reasons.push("No phone on file");
      score += 1;
    }
    return {
      member_id: member.id,
      full_name: member.full_name,
      email: member.email,
      reasons,
      score,
    };
  });

  const filtered = rows
    .filter((r) => r.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);

  return NextResponse.json({ rows: filtered });
}
