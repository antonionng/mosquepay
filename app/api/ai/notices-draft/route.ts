import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
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
    opening_text: `Members, the Lead Imam invites you to the ${eventTitle}, to be held on ${new Date(eventDate).toLocaleDateString("en-GB", { dateStyle: "full" })}. Your presence and support are warmly requested.`,
    agenda_items: [
      "Opening of the mosque",
      "Reading and confirmation of minutes",
      "Correspondence",
      "Ballot, ceremony and lecture",
      "PastoralCare and charity matters",
      "Treasurer's report",
      "Risings",
      "Closing of the mosque",
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
  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("notice:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const eventId = String(body.event_id ?? "");
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id is required." },
      { status: 400 }
    );
  }
  const event = await db.getEventById(eventId, mosqueId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const mosque = await db.getMosqueBySlug(mosqueSlug);

  const aiDraft = await completeJSON<NoticeDraft>({
    system:
      "You draft mosque service notices. Reply with strict JSON: { opening_text: string, agenda_items: string[], notices: string[] }. Tone: warm and welcoming, appropriate for a UK mosque congregation.",
    user: `Mosque: ${mosque?.name ?? ""}\nService title: ${event.title}\nService date: ${event.event_date}\nService type: ${event.event_type ?? "Regular service"}\nLocation: ${event.location ?? ""}\nNotes: ${body.notes ?? ""}\n\nPlease draft an opening paragraph, an agenda (8 items max), and 2-3 short notices that fit a typical English mosque notice.`,
    temperature: 0.5,
  });

  const draft = aiDraft ?? fallbackDraft(event.title, event.event_date);
  return NextResponse.json({
    draft,
    source: process.env.OPENAI_API_KEY && aiDraft ? "ai" : "fallback",
  });
}
