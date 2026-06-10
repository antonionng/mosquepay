import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { writeAuditLog } from "@/lib/audit";
import { defaultAgendaItems, renderDefaultNoticeOpening } from "@/lib/notices/defaults";

type Params = { params: Promise<{ eventId: string }> };

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

function cleanNewcomerOfficers(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((officer) => {
      if (!officer || typeof officer !== "object") return null;
      const item = officer as Record<string, unknown>;
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const email = typeof item.email === "string" ? item.email.trim() : "";
      const phone = typeof item.phone === "string" ? item.phone.trim() : "";
      if (!name && !email && !phone) return null;

      return { name, email: email || null, phone: phone || null };
    })
    .filter((officer): officer is { name: string; email: string | null; phone: string | null } =>
      Boolean(officer)
    );
}

export async function GET(request: NextRequest, { params }: Params) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      notice: {
        issue_date: new Date().toISOString().slice(0, 10),
        opening_text: null,
        agenda_items: defaultAgendaItems(),
        menu_items: [],
        dining_time: null,
        notices: [],
        include_member_directory: true,
        newcomer_contact_name: null,
        newcomer_contact_email: null,
        newcomer_contact_phone: null,
        newcomer_contacts: [],
        next_service_date: null,
        next_service_note: null,
        service_lead_name: null,
        service_lead_role: null,
      },
    });
  }

  const { eventId } = await params;
  const adminCtx = await getAdminReadContext();
  if (adminCtx.mode !== "database" || !adminCtx.churchId) {
    return NextResponse.json({ error: "Church not selected." }, { status: 404 });
  }
  const churchId = adminCtx.churchId;

  const [event, church] = await Promise.all([
    db.getEventById(eventId, churchId),
    db.getChurchById(churchId),
  ]);
  if (!event) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 });
  }

  const notice = await db.getServiceNotice(eventId, churchId);
  const sends = await db.listServiceNoticeSends(churchId, eventId);
  return NextResponse.json({
    event,
    sends,
    notice: notice ?? {
      issue_date: new Date().toISOString().slice(0, 10),
      opening_text: renderDefaultNoticeOpening(event, church),
      agenda_items: defaultAgendaItems(),
      menu_items: [],
      dining_time: event.event_time ?? null,
      notices: [],
      include_member_directory: true,
      newcomer_contact_name: null,
      newcomer_contact_email: null,
      newcomer_contact_phone: null,
      newcomer_contacts: [],
      next_service_date: null,
      next_service_note: null,
      service_lead_name: null,
      service_lead_role: null,
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
    const adminCtx = await getAdminReadContext();
    if (adminCtx.mode !== "database" || !adminCtx.churchId) {
      return NextResponse.json({ error: "Church not selected." }, { status: 404 });
    }
    const churchId = adminCtx.churchId;
    const forbidden = await requireAdminApiPermission("notice:write", churchId);
    if (forbidden) return forbidden;

    const event = await db.getEventById(eventId, churchId);
    if (!event) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 });
    }

    const body = await request.json();
    const newcomerContacts = cleanNewcomerOfficers(body.newcomer_contacts);
    const primaryNewcomerOfficer = newcomerContacts[0];
    const notice = await db.upsertServiceNotice(churchId, eventId, {
      issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
      opening_text: body.opening_text?.trim() || null,
      agenda_items: cleanList(body.agenda_items),
      menu_items: cleanList(body.menu_items),
      dining_time: body.dining_time?.trim() || null,
      notices: cleanList(body.notices),
      include_member_directory: body.include_member_directory !== false,
      newcomer_contact_name: primaryNewcomerOfficer?.name || null,
      newcomer_contact_email: primaryNewcomerOfficer?.email || null,
      newcomer_contact_phone: primaryNewcomerOfficer?.phone || null,
      newcomer_contacts: newcomerContacts,
      next_service_date: body.next_service_date?.trim() || null,
      next_service_note: body.next_service_note?.trim() || null,
      service_lead_name: body.service_lead_name?.trim() || null,
      service_lead_role:
        body.service_lead_role?.trim() || null,
    });

    // Editing a notice reverts it back to draft so an approval is required
    // again before sending. This keeps the human gate honest after any edit.
    if (event.notice_status !== "sent") {
      await db.setServiceNoticeStatus(event.id, churchId, "draft", {
        notice_approved_at: null,
        notice_approved_by_email: null,
      });
    }

    await writeAuditLog({
      churchId,
      action: "updated",
      entityType: "notice",
      entityId: notice.id,
      summary: `Updated notice for ${event.title}`,
    });
    return NextResponse.json({ notice });
  } catch (error) {
    console.error("Notice PATCH error:", error);
    return NextResponse.json({ error: "Failed to save notice." }, { status: 500 });
  }
}
