import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { eventsToIcs } from "@/lib/calendar/ics";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  if (!isSupabaseConfigured()) {
    return new NextResponse("Calendar feed not available", { status: 503 });
  }

  const { token } = await params;
  if (!token) {
    return new NextResponse("Token required", { status: 400 });
  }

  const member = await db.getMemberByPortalToken(token);
  if (!member || member.membership_status !== "active") {
    return new NextResponse("Calendar not found", { status: 404 });
  }

  const lodge = await db.getLodgeById(member.lodge_id);
  const events = await db.getEvents(member.lodge_id, { published: true });

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const ics = eventsToIcs({
    calendarName: lodge?.name ?? "Lodge calendar",
    events,
    origin,
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=600",
      "Content-Disposition": `inline; filename="lodge-${member.lodge_id}.ics"`,
    },
  });
}
