import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getChurchSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeJSON } from "@/lib/ai/client";

type NoticeDraft = {
  opening_text: string;
  agenda_items: string[];
  notices: string[];
};

function fallbackDraft(eventTitle: string, eventDate: string): NoticeDraft {
  return {
    opening_text: `Members, the Lead Pastor invites you to the ${eventTitle}, to be held on ${new Date(eventDate).toLocaleDateString("en-GB", { dateStyle: "full" })}. Your presence and support are warmly requested.`,
    agenda_items: [
      "Opening of the church",
      "Reading and confirmation of minutes",
      "Correspondence",
      "Ballot, ceremony and lecture",
      "PastoralCare and charity matters",
      "Treasurer's report",
      "Risings",
      "Closing of the church",
    ],
    notices: [
      "Please reply with apologies in good time so that catering numbers can be confirmed.",
      "Members are reminded to settle outstanding giving before the service.",
    ],
  };
}

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdminApiAuth();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Database not configured." },
      { status: 503 }
    );
  }
  const churchSlug = getChurchSlugFromRequest(request);
  const churchId = await db.resolveChurchId(churchSlug);
  if (!churchId) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", churchId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const eventId = String(body.event_id ?? "");
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id is required." },
      { status: 400 }
    );
  }
  const event = await db.getEventById(eventId, churchId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const church = await db.getChurchBySlug(churchSlug);

  const aiDraft = await completeJSON<NoticeDraft>({
    system:
      "You draft church service notices. Reply with strict JSON: { opening_text: string, agenda_items: string[], notices: string[] }. Tone: warm and welcoming, appropriate for a UK church congregation.",
    user: `Church: ${church?.name ?? ""}\nService title: ${event.title}\nService date: ${event.event_date}\nService type: ${event.event_type ?? "Regular service"}\nLocation: ${event.location ?? ""}\nNotes: ${body.notes ?? ""}\n\nPlease draft an opening paragraph, an agenda (8 items max), and 2-3 short notices that fit a typical English church notice.`,
    temperature: 0.5,
  });

  const draft = aiDraft ?? fallbackDraft(event.title, event.event_date);
  return NextResponse.json({
    draft,
    source: process.env.OPENAI_API_KEY && aiDraft ? "ai" : "fallback",
  });
}
