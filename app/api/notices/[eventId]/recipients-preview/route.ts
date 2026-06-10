import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import { buildRecipientsPreview } from "@/lib/fees/recipients-preview";

type Params = { params: Promise<{ eventId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { eventId } = await params;
    const churchSlug = getChurchSlugFromRequest(request);
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("notice:write", churchId);
    if (forbidden) return forbidden;

    const url = new URL(request.url);
    const includeMembers = url.searchParams.get("include_members") !== "false";
    const includeHonoraryGuests =
      url.searchParams.get("include_honorary_guests") !== "false";

    const [event, members, honoraryGuests, defaults, notice, overrides] =
      await Promise.all([
        db.getEventById(eventId, churchId),
        db.getMembers(churchId, { status: "active" }),
        db.listHonoraryGuests(churchId),
        db.getChurchFeeDefaults(churchId),
        db.getServiceNotice(eventId, churchId),
        db.listEventFeeOverrides(churchId, eventId),
      ]);

    if (!event) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const includeHonorary =
      includeHonoraryGuests && (notice?.include_honorary_guests !== false);

    const preview = buildRecipientsPreview({
      members,
      honoraryGuests,
      event,
      defaults,
      includeMembers,
      includeHonoraryGuests: includeHonorary,
      overrides,
    });

    return NextResponse.json({
      include_members: includeMembers,
      include_honorary_guests: includeHonorary,
      event: {
        id: event.id,
        dining_waived_for_all: event.dining_waived_for_all === true,
        enable_dining_rsvp: event.enable_dining_rsvp === true,
        enable_service_fee: event.enable_service_fee === true,
      },
      ...preview,
    });
  } catch (error) {
    console.error("Recipients preview error:", error);
    return NextResponse.json(
      { error: "Failed to load recipients preview." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  try {
    const { eventId } = await params;
    const churchSlug = getChurchSlugFromRequest(request);
    const churchId = await db.resolveChurchId(churchSlug);
    if (!churchId) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const forbidden = await requireAdminApiPermission("notice:write", churchId);
    if (forbidden) return forbidden;

    const body = await request.json().catch(() => ({}));

    const existing = await db.getServiceNotice(eventId, churchId);
    let notice = existing ?? null;
    if (Object.prototype.hasOwnProperty.call(body, "include_honorary_guests")) {
      const includeHonoraryGuests = body.include_honorary_guests !== false;
      notice = await db.upsertServiceNotice(churchId, eventId, {
        ...(existing ?? {}),
        include_honorary_guests: includeHonoraryGuests,
      });
    }

    let event: Awaited<ReturnType<typeof db.getEventById>> = null;
    if (
      Object.prototype.hasOwnProperty.call(body, "dining_waived_for_all")
    ) {
      const flag = body.dining_waived_for_all === true;
      event = await db.updateEvent(eventId, churchId, {
        dining_waived_for_all: flag,
      });
    }

    return NextResponse.json({ notice, event });
  } catch (error) {
    console.error("Recipients PATCH error:", error);
    return NextResponse.json(
      { error: "Failed to update invite settings." },
      { status: 500 }
    );
  }
}
