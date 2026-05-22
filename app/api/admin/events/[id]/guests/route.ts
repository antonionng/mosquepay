import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  const { id: eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);

  const format = request.nextUrl.searchParams.get("format");

  let guests: Array<{
    id: string;
    guest_name: string;
    email: string | null;
    phone: string | null;
    dietary_requirements: string | null;
    source: string;
    created_at: string;
  }> = [];

  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("meetings:write", lodgeId);
    if (forbidden) return forbidden;

    guests = await db.listEventGuestsForLodge(lodgeId, { eventId });
  } else if (shouldUseInMemoryMock()) {
    guests = mockDb.getGuestsByEvent(eventId, { lodge_slug: lodgeSlug }).map(
      (g) => ({
        id: g.id,
        guest_name: g.guest_name,
        email: g.email,
        phone: g.phone,
        dietary_requirements: g.dietary_requirements,
        source: g.source,
        created_at: g.created_at,
      })
    );
  }

  if (format === "csv") {
    const header = ["Name", "Email", "Phone", "Dietary", "Source", "Registered"];
    const rows = guests.map((g) => [
      g.guest_name,
      g.email ?? "",
      g.phone ?? "",
      g.dietary_requirements ?? "",
      g.source,
      g.created_at,
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value)
              ? `"${value.replaceAll('"', '""')}"`
              : value;
          })
          .join(",")
      )
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="event-${eventId}-guests.csv"`,
      },
    });
  }

  return NextResponse.json({ guests });
}
