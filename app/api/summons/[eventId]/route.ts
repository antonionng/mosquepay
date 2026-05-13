import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { writeAuditLog } from "@/lib/audit";
import { defaultAgendaItems, renderDefaultSummonsOpening } from "@/lib/summons/defaults";

type Params = { params: Promise<{ eventId: string }> };

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      summons: {
        issue_date: new Date().toISOString().slice(0, 10),
        opening_text: null,
        agenda_items: defaultAgendaItems(),
        menu_items: [],
        dining_time: null,
        notices: [],
        include_member_directory: true,
      },
    });
  }

  const { eventId } = await params;
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  const [event, lodge] = await Promise.all([
    db.getEventById(eventId, lodgeId),
    db.getLodgeById(lodgeId),
  ]);
  if (!event) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const summons = await db.getEventSummons(eventId, lodgeId);
  const sends = await db.listEventSummonsSends(lodgeId, eventId);
  return NextResponse.json({
    event,
    sends,
    summons: summons ?? {
      issue_date: new Date().toISOString().slice(0, 10),
      opening_text: renderDefaultSummonsOpening(event, lodge),
      agenda_items: defaultAgendaItems(),
      menu_items: [],
      dining_time: event.event_time ?? null,
      notices: [],
      include_member_directory: true,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { eventId } = await params;
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    if (!lodgeId) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("summons:write", lodgeId);
    if (forbidden) return forbidden;

    const event = await db.getEventById(eventId, lodgeId);
    if (!event) {
      return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
    }

    const body = await request.json();
    const summons = await db.upsertEventSummons(lodgeId, eventId, {
      issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
      opening_text: body.opening_text?.trim() || null,
      agenda_items: cleanList(body.agenda_items),
      menu_items: cleanList(body.menu_items),
      dining_time: body.dining_time?.trim() || null,
      notices: cleanList(body.notices),
      include_member_directory: body.include_member_directory !== false,
    });

    // Editing a summons reverts it back to draft so an approval is required
    // again before sending. This keeps the human gate honest after any edit.
    if (event.summons_status !== "sent") {
      await db.setEventSummonsStatus(event.id, lodgeId, "draft", {
        summons_approved_at: null,
        summons_approved_by_email: null,
      });
    }

    await writeAuditLog({
      lodgeId,
      action: "updated",
      entityType: "summons",
      entityId: summons.id,
      summary: `Updated summons for ${event.title}`,
    });
    return NextResponse.json({ summons });
  } catch (error) {
    console.error("Summons PATCH error:", error);
    return NextResponse.json({ error: "Failed to save summons." }, { status: 500 });
  }
}
