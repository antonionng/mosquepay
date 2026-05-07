import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
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
    next_action: "Call within 48 hours to introduce the lodge and answer questions.",
    reasoning: "First contact within two days dramatically increases conversion.",
    due_in_days: 2,
  },
  contacted: {
    next_action: "Invite to next white-table evening or open meeting.",
    reasoning: "Letting the lead meet brethren in a relaxed setting builds confidence.",
    due_in_days: 14,
  },
  proposed: {
    next_action: "Confirm proposer and seconder, and schedule the ballot date.",
    reasoning: "Keep momentum and clarity around process timelines.",
    due_in_days: 21,
  },
  balloted: {
    next_action: "Send a warm congratulations and book the initiation date.",
    reasoning: "Make the candidate feel welcomed immediately after a successful ballot.",
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
  const lodgeSlug = getLodgeSlugFromRequest(request);
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;
  const body = await request.json();
  const leadId = String(body.lead_id ?? "");
  const lead = await db.getLeadById(leadId, lodgeId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  }
  const activities = await db
    .getLeadActivities(leadId, lodgeId)
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
      "You suggest the next concrete action to convert a Masonic lodge prospect. Reply with strict JSON: { next_action: string, reasoning: string, due_in_days: number }. Be respectful and never apply pressure tactics.",
    user: `Lead stage: ${lead.stage}\nName: ${lead.first_name} ${lead.last_name}\nSource: ${lead.source ?? "unknown"}\nNotes: ${lead.notes ?? "(none)"}\nRecent activity:\n${recent || "(no recent activity)"}\nProposer: ${lead.proposer_name ?? "(none)"}\nSeconder: ${lead.seconder_name ?? "(none)"}`,
    temperature: 0.4,
  });

  const fallback = FALLBACK[lead.stage] ?? FALLBACK.new;
  return NextResponse.json({
    suggestion: ai ?? fallback,
    source: ai ? "ai" : "fallback",
  });
}
