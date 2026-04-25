import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function POST(request: NextRequest) {
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const lead_id = body.lead_id;
    const activity_type = body.activity_type;
    const title = body.title?.trim() ?? null;
    const description = body.description?.trim() ?? null;
    const meeting_date = body.meeting_date ?? null;

    if (!lead_id || !activity_type) {
      return NextResponse.json(
        { error: "Lead ID and activity type are required." },
        { status: 400 }
      );
    }

    const validTypes = ["note", "meeting", "phone_call", "email", "task", "stage_change"];
    if (!validTypes.includes(activity_type)) {
      return NextResponse.json(
        { error: "Invalid activity type." },
        { status: 400 }
      );
    }

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
        attendees: null,
        due_date: null,
        completed: false,
        created_by: null,
      });
      return NextResponse.json({ id: activity.id, success: true });
    }

    const activity = mockDb.addLeadActivity({
      lodge_slug: lodgeSlug,
      lead_id,
      activity_type,
      title,
      description,
      meeting_date: meeting_date || null,
      attendees: null,
      due_date: null,
      completed: false,
      created_by: null,
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
