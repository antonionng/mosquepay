import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeJSON } from "@/lib/ai/client";

type CommunicationCategory =
  | "members_newsletter"
  | "post_meeting_recap"
  | "event_reminder"
  | "candidate_follow_up"
  | "dues_reminder"
  | "welfare_check_in"
  | "charity_appeal";

type CommunicationAudience = "active_members" | "all_members" | "leads";

type CommunicationDraft = {
  subject: string;
  html_body: string;
  recommended_audience: CommunicationAudience;
  admin_notes: string[];
};

const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  members_newsletter: "Members newsletter",
  post_meeting_recap: "Post-meeting recap",
  event_reminder: "Event reminder",
  candidate_follow_up: "Candidate follow-up",
  dues_reminder: "Dues reminder",
  welfare_check_in: "Welfare check-in",
  charity_appeal: "Charity appeal",
};

const CATEGORY_AUDIENCES: Record<CommunicationCategory, CommunicationAudience> = {
  members_newsletter: "active_members",
  post_meeting_recap: "active_members",
  event_reminder: "active_members",
  candidate_follow_up: "leads",
  dues_reminder: "active_members",
  welfare_check_in: "active_members",
  charity_appeal: "all_members",
};

const CATEGORY_GUIDANCE: Record<CommunicationCategory, string> = {
  members_newsletter:
    "A concise monthly lodge update with recent highlights, upcoming dates, charity notes, and a warm closing.",
  post_meeting_recap:
    "A warm thank-you after a meeting with a short recap and next steps.",
  event_reminder:
    "A practical reminder about an upcoming meeting or event, including RSVP and dining prompts.",
  candidate_follow_up:
    "A friendly follow-up to prospective members, encouraging the next conversation without pressure.",
  dues_reminder:
    "A polite Treasurer-style payment reminder that is firm, clear, and respectful.",
  welfare_check_in:
    "A sensitive Almoner-style check-in. Keep it personal, gentle, and never speculative.",
  charity_appeal:
    "A positive charity update or appeal with a clear reason to support the lodge campaign.",
};

const ALLOWED_CATEGORIES = new Set<CommunicationCategory>(
  Object.keys(CATEGORY_LABELS) as CommunicationCategory[]
);

function cleanText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function cleanCategory(value: unknown): CommunicationCategory {
  return ALLOWED_CATEGORIES.has(value as CommunicationCategory)
    ? (value as CommunicationCategory)
    : "members_newsletter";
}

function cleanAudience(value: unknown, fallback: CommunicationAudience) {
  return value === "active_members" || value === "all_members" || value === "leads"
    ? value
    : fallback;
}

function normalizeDraft(
  draft: Partial<CommunicationDraft>,
  category: CommunicationCategory,
  lodgeName: string
): CommunicationDraft {
  const fallback = fallbackDraft(category, lodgeName, "");
  const notes = Array.isArray(draft.admin_notes)
    ? draft.admin_notes.filter((note): note is string => typeof note === "string")
    : fallback.admin_notes;

  return {
    subject: cleanText(draft.subject, fallback.subject).slice(0, 140),
    html_body: cleanText(draft.html_body, fallback.html_body),
    recommended_audience: cleanAudience(
      draft.recommended_audience,
      CATEGORY_AUDIENCES[category]
    ),
    admin_notes: notes.length ? notes.slice(0, 5) : fallback.admin_notes,
  };
}

function fallbackDraft(
  category: CommunicationCategory,
  lodgeName: string,
  notes: string
): CommunicationDraft {
  const label = CATEGORY_LABELS[category];
  const noteParagraph = notes
    ? `<p>${escapeHtml(notes)}</p>`
    : "<p>Please add the latest lodge details before sending.</p>";

  return {
    subject:
      category === "dues_reminder"
        ? "Reminder: lodge dues"
        : category === "candidate_follow_up"
          ? `An update from ${lodgeName}`
          : `${lodgeName}: ${label}`,
    html_body: [
      "<p>Dear {{first_name}},</p>",
      `<p>Here is a short ${label.toLowerCase()} from ${lodgeName}.</p>`,
      noteParagraph,
      "<p>Yours fraternally,<br/>The Secretary</p>",
    ].join("\n"),
    recommended_audience: CATEGORY_AUDIENCES[category],
    admin_notes: [
      "Review the wording before sending.",
      "Preview the audience count first.",
      "Send a test or small batch if the content is sensitive.",
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
  const forbidden = await requireAdminApiPermission("members:write", lodgeId);
  if (forbidden) return forbidden;

  const [body, lodge] = await Promise.all([
    request.json().catch(() => ({})),
    db.getLodgeById(lodgeId),
  ]);
  const category = cleanCategory(body.category);
  const notes = cleanText(body.notes);
  const eventId = cleanText(body.event_id);
  const event = eventId ? await db.getEventById(eventId, lodgeId) : null;
  const lodgeName = lodge?.name ?? "the lodge";

  const aiDraft = await completeJSON<CommunicationDraft>({
    system:
      "You draft lodge communications for admins. Reply with strict JSON: { subject: string, html_body: string, recommended_audience: 'active_members'|'all_members'|'leads', admin_notes: string[] }. html_body must be safe email HTML using paragraphs, headings, lists, and merge tag {{first_name}}. Do not include private ritual details, sensitive speculation, or claims of secrecy.",
    user: `Lodge: ${lodgeName}
Category: ${CATEGORY_LABELS[category]}
Audience guidance: ${CATEGORY_AUDIENCES[category]}
Content guidance: ${CATEGORY_GUIDANCE[category]}
Event: ${event ? `${event.title} on ${event.event_date}` : "None selected"}
Admin notes: ${notes || "None provided"}

Draft a ready-to-review email with a useful subject, concise body, and 2-4 admin review notes.`,
    temperature: 0.55,
  });

  const draft = aiDraft
    ? normalizeDraft(aiDraft, category, lodgeName)
    : fallbackDraft(category, lodgeName, notes);

  return NextResponse.json({
    draft,
    source: aiDraft ? "ai" : "fallback",
  });
}
