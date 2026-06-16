import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeJSON } from "@/lib/ai/client";

type Suggestion = {
  next_action: string;
  reasoning: string;
  due_in_days: number;
};

const FALLBACK: Record<string, Suggestion> = {
  new: {
    next_action: "Call within 48 hours to introduce the mosque and answer questions.",
    reasoning: "First contact within two days dramatically increases conversion.",
    due_in_days: 2,
  },
  contacted: {
    next_action: "Invite to next white-table evening or open service.",
    reasoning: "Letting the newcomer meet members in a relaxed setting builds confidence.",
    due_in_days: 14,
  },
  proposed: {
    next_action: "Confirm proposer and seconder, and schedule the membership decision date.",
    reasoning: "Keep momentum and clarity around process timelines.",
    due_in_days: 21,
  },
  membership_decisioned: {
    next_action: "Send a warm congratulations and book the membership date.",
    reasoning: "Make the newcomer feel welcomed immediately after a successful membership decision.",
    due_in_days: 7,
  },
  joined: {
    next_action: "Pair with a mentor and add to the next dining list.",
    reasoning: "First-year support is the strongest predictor of long-term retention.",
    due_in_days: 14,
  },
};

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
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const newcomerId = String(body.newcomer_id ?? "");
  const newcomer = await db.getNewcomerById(newcomerId, mosqueId);
  if (!newcomer) {
    return NextResponse.json({ error: "Newcomer not found." }, { status: 404 });
  }
  const activities = await db
    .getNewcomerActivities(newcomerId, mosqueId)
    .catch(() => []);
  const recent = activities
    .slice(0, 5)
    .map(
      (a) =>
        `- ${a.created_at}: ${a.activity_type} - ${a.title ?? ""} ${a.description ?? ""}`
    )
    .join("\n");

  const ai = await completeJSON<Suggestion>({
    system:
      "You suggest the next concrete follow-up action for a mosque newcomer. Reply with strict JSON: { next_action: string, reasoning: string, due_in_days: number }. Be warm and respectful and never apply pressure tactics.",
    user: `Newcomer stage: ${newcomer.stage}\nName: ${newcomer.first_name} ${newcomer.last_name}\nSource: ${newcomer.source ?? "unknown"}\nNotes: ${newcomer.notes ?? "(none)"}\nRecent activity:\n${recent || "(no recent activity)"}\nProposer: ${newcomer.proposer_name ?? "(none)"}\nSeconder: ${newcomer.seconder_name ?? "(none)"}`,
    temperature: 0.4,
  });

  const fallback = FALLBACK[newcomer.stage] ?? FALLBACK.new;
  return NextResponse.json({
    suggestion: ai ?? fallback,
    source: ai ? "ai" : "fallback",
  });
}
