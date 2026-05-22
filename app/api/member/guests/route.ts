import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { createClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ invitations: [], events: [] });
  }
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const member =
    (await db.getMemberByAuthUserId(user.id)) ??
    (await db.getMemberByEmailAcrossLodges(user.email));
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitations = await db.listGuestInvitationsForMember(
    member.id,
    member.lodge_id
  );

  const eventIds = Array.from(new Set(invitations.map((i) => i.event_id)));
  const events = (
    await Promise.all(
      eventIds.map((id) => db.getEventById(id, member.lodge_id))
    )
  ).filter((event): event is NonNullable<typeof event> => Boolean(event));

  return NextResponse.json({ invitations, events });
}
