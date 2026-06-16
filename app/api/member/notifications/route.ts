import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import {
  OPTIONAL_PREFERENCES,
  CRITICAL_EVENT_TYPES,
  listMemberOptOuts,
  setMemberPreference,
} from "@/lib/email/preferences";

export const dynamic = "force-dynamic";

async function resolveMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return null;
  return (
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossMosques(user.email))
  );
}

export async function GET() {
  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const optOuts = await listMemberOptOuts(member.id);

  const groups = OPTIONAL_PREFERENCES.map((g) => ({
    group: g.group,
    items: g.items.map((i) => ({
      eventType: i.eventType,
      label: i.label,
      description: i.description,
      enabled: !optOuts.has(i.eventType),
    })),
  }));

  return NextResponse.json({
    member: {
      id: member.id,
      email: member.email,
      full_name: member.full_name,
    },
    groups,
    criticalEventTypes: Array.from(CRITICAL_EVENT_TYPES),
  });
}

export async function POST(req: Request) {
  const member = await resolveMember();
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { event_type?: unknown; enabled?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = typeof body.event_type === "string" ? body.event_type : null;
  const enabled = body.enabled === true;
  if (!eventType) {
    return NextResponse.json({ error: "event_type required" }, { status: 400 });
  }
  if (CRITICAL_EVENT_TYPES.has(eventType)) {
    return NextResponse.json(
      { error: "This alert is required and cannot be muted." },
      { status: 400 },
    );
  }

  // Confirm the event_type is one of the optional ones we expose;
  // otherwise a crafted client could pollute the table with arbitrary
  // strings.
  const allowed = new Set(
    OPTIONAL_PREFERENCES.flatMap((g) => g.items.map((i) => i.eventType)),
  );
  if (!allowed.has(eventType)) {
    return NextResponse.json(
      { error: "Unknown preference key" },
      { status: 400 },
    );
  }

  await setMemberPreference(member.id, eventType, enabled);
  return NextResponse.json({ ok: true });
}
