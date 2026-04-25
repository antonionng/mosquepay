import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

/** Stages accepted from admin CRM (list, detail, kanban) and public enquiry flow. */
const VALID_STAGES = [
  "expression_of_interest",
  "new_enquiry",
  "initial_contact",
  "meeting_scheduled",
  "proposal_lodge",
  "approved",
  "initiated",
  "declined",
  "on_hold",
  "informal_meeting_1",
  "meeting_2",
  "preflight_meeting",
  "application_completion",
  "initiation_briefing",
  "initiation",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();
    const stage = body.stage;

    if (!stage || !VALID_STAGES.includes(stage)) {
      return NextResponse.json(
        { error: "Valid stage is required." },
        { status: 400 }
      );
    }

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const updated = await db.updateLead(id, lodgeId, { stage });
      if (!updated) {
        return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    const updated = mockDb.updateLead(id, { stage }, { lodge_slug: lodgeSlug });
    if (!updated) {
      return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Leads PATCH API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
