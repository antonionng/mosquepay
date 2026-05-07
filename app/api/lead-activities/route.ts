import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth } from "@/lib/auth/api";
import { getCurrentAdminContextAny } from "@/lib/auth/permissions";

const VALID_TYPES = [
  "note",
  "meeting",
  "phone_call",
  "email",
  "task",
  "stage_change",
];

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const lead_id = body.lead_id;
    const activity_type = body.activity_type;
    const title = body.title?.trim() ?? null;
    const description = body.description?.trim() ?? null;
    const meeting_date = body.meeting_date ?? null;
    const due_date = body.due_date ?? null;
    const attendees = Array.isArray(body.attendees)
      ? body.attendees.filter(
          (a: unknown): a is string => typeof a === "string" && a.trim().length > 0
        )
      : null;
    const completed = body.completed === true;

    if (!lead_id || !activity_type) {
      return NextResponse.json(
        { error: "Lead ID and activity type are required." },
        { status: 400 }
      );
    }

    if (!VALID_TYPES.includes(activity_type)) {
      return NextResponse.json(
        { error: "Invalid activity type." },
        { status: 400 }
      );
    }

    const ctx = await getCurrentAdminContextAny();
    const createdBy = ctx?.email ?? null;

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const activity = await db.addLeadActivity(lodgeId, {
        lead_id,
        activity_type,
        title,
        description,
        meeting_date: meeting_date || null,
        attendees: attendees && attendees.length > 0 ? attendees : null,
        due_date: due_date || null,
        completed,
        created_by: null,
      });
      return NextResponse.json({
        id: activity.id,
        success: true,
        created_by: createdBy,
      });
    }

    const activity = mockDb.addLeadActivity({
      lodge_slug: lodgeSlug,
      lead_id,
      activity_type,
      title,
      description,
      meeting_date: meeting_date || null,
      attendees: attendees && attendees.length > 0 ? attendees : null,
      due_date: due_date || null,
      completed,
      created_by: createdBy,
    });

    return NextResponse.json({ id: activity.id, success: true });
  } catch (e) {
    console.error("Lead activities API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
