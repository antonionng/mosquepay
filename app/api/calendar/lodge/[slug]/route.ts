import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { eventsToIcs } from "@/lib/calendar/ics";

/**
 * Public lodge ICS feed for published events. Subscribe in
 * Google/Apple/Outlook Calendar by URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const { slug } = await params;
  const lodge = await db.getLodgeBySlug(slug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const events = await db.getEvents(lodge.id, {
    published: true,
    upcoming: true,
  });
  const origin = request.nextUrl.origin;
  const ics = eventsToIcs({
    calendarName: `${lodge.name} - Public events`,
    events,
    origin,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${lodge.slug}.ics"`,
      "Cache-Control": "public, max-age=900",
    },
  });
}
