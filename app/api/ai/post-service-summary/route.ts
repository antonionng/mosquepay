import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeText } from "@/lib/ai/client";

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
  const forbidden = await requireAdminApiPermission("services:write", mosqueId);
  if (forbidden) return forbidden;

  const body = await request.json();
  const eventId = String(body.event_id ?? "");
  const event = await db.getEventById(eventId, mosqueId);
  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const rsvps = await db.getRsvpsByEventId(eventId, mosqueId);
  const attended = rsvps.filter((r) => r.status === "yes").length;
  const apologies = rsvps.filter((r) => r.status === "apologies").length;
  const summary = await completeText({
    system:
      "You write concise, warm post-service summaries for a mosque newsletter. Three short paragraphs maximum.",
    user: `Service: ${event.title}\nDate: ${event.event_date}\nAttended: ${attended}\nApologies: ${apologies}\nLocation: ${event.location ?? ""}\nNotes from secretary: ${body.notes ?? "None provided."}\n\nDraft a thank-you and recap suitable for sharing with members.`,
    temperature: 0.6,
  });

  const fallback = `${event.title} took place on ${new Date(event.event_date).toLocaleDateString("en-GB", { dateStyle: "full" })}. We were pleased to welcome ${attended} members to the service, with ${apologies} apologies received. Thank you to everyone who attended and supported the work of the mosque. Details of upcoming services and events will follow shortly.`;

  return NextResponse.json({
    summary: summary ?? fallback,
    source: summary ? "ai" : "fallback",
    stats: { attended, apologies, total: rsvps.length },
  });
}
