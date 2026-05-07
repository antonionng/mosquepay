import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeJSON } from "@/lib/ai/client";

type SummonsDraft = {
  opening_text: string;
  agenda_items: string[];
  notices: string[];
};

function fallbackDraft(eventTitle: string, eventDate: string): SummonsDraft {
  return {
    opening_text: `Brethren, the Worshipful Master invites you to the ${eventTitle}, to be held on ${new Date(eventDate).toLocaleDateString("en-GB", { dateStyle: "full" })}. Your presence and support are warmly requested.`,
    agenda_items: [
      "Opening of the lodge",
      "Reading and confirmation of minutes",
      "Correspondence",
      "Ballot, ceremony and lecture",
      "Almoner and charity matters",
      "Treasurer's report",
      "Risings",
      "Closing of the lodge",
    ],
    notices: [
      "Please reply with apologies in good time so that catering numbers can be confirmed.",
      "Members are reminded to settle outstanding dues before the meeting.",
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("summons:write", lodgeId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const eventId = String(body.event_id ?? "");
  if (!eventId) {
    return NextResponse.json(
      { error: "event_id is required." },
      { status: 400 }
    );
  }
  const event = await db.getEventById(eventId, lodgeId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const lodge = await db.getLodgeBySlug(lodgeSlug);

  const aiDraft = await completeJSON<SummonsDraft>({
    system:
      "You draft Masonic lodge summonses. Reply with strict JSON: { opening_text: string, agenda_items: string[], notices: string[] }. Tone: warm but formal, in line with English ritual conventions. No claims of secrecy or exclusivity.",
    user: `Lodge: ${lodge?.name ?? ""}\nMeeting title: ${event.title}\nMeeting date: ${event.event_date}\nMeeting type: ${event.event_type ?? "Regular meeting"}\nLocation: ${event.location ?? ""}\nNotes: ${body.notes ?? ""}\n\nPlease draft an opening paragraph, an agenda (8 items max), and 2-3 short notices that fit a typical English lodge summons.`,
    temperature: 0.5,
  });

  const draft = aiDraft ?? fallbackDraft(event.title, event.event_date);
  return NextResponse.json({
    draft,
    source: process.env.OPENAI_API_KEY && aiDraft ? "ai" : "fallback",
  });
}
