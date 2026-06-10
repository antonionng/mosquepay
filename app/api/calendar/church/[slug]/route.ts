import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { eventsToIcs } from "@/lib/calendar/ics";
import { filterPubliclyVisible } from "@/lib/events/public-visibility";

/**
 * Public church ICS feed for published events. Subscribe in
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
  const church = await db.getChurchBySlug(slug);
  if (!church) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const allUpcoming = await db.getEvents(church.id, {
    published: true,
    upcoming: true,
  });
  const events = filterPubliclyVisible(allUpcoming);
  const origin = request.nextUrl.origin;
  const ics = eventsToIcs({
    calendarName: `${church.name} - Public events`,
    events,
    origin,
    churchSlug: church.slug,
  });
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${church.slug}.ics"`,
      "Cache-Control": "public, max-age=900",
    },
  });
}
