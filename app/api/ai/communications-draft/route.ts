import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import {
  requireAdminApiAuth,
  requireAdminApiPermission,
} from "@/lib/auth/api";
import { completeJSON } from "@/lib/ai/client";

type CommunicationCategory =
  | "members_newsletter"
  | "post_service_recap"
  | "event_reminder"
  | "newcomer_follow_up"
  | "giving_reminder"
  | "pastoral_check_in"
  | "charity_appeal";

type CommunicationAudience = "active_members" | "all_members" | "newcomers";

type CommunicationDraft = {
  subject: string;
  html_body: string;
  recommended_audience: CommunicationAudience;
  admin_notes: string[];
};

const CATEGORY_LABELS: Record<CommunicationCategory, string> = {
  members_newsletter: "Members newsletter",
  post_service_recap: "Post-service recap",
  event_reminder: "Event reminder",
  newcomer_follow_up: "Newcomer follow-up",
  giving_reminder: "Giving reminder",
  pastoral_check_in: "PastoralCare check-in",
  charity_appeal: "Charity appeal",
};

const CATEGORY_AUDIENCES: Record<CommunicationCategory, CommunicationAudience> = {
  members_newsletter: "active_members",
  post_service_recap: "active_members",
  event_reminder: "active_members",
  newcomer_follow_up: "newcomers",
  giving_reminder: "active_members",
  pastoral_check_in: "active_members",
  charity_appeal: "all_members",
};

const CATEGORY_GUIDANCE: Record<CommunicationCategory, string> = {
  members_newsletter:
    "A concise monthly mosque update with recent highlights, upcoming dates, charity notes, and a warm closing.",
  post_service_recap:
    "A warm thank-you after a service with a short recap and next steps.",
  event_reminder:
    "A practical reminder about an upcoming service or event, including RSVP and dining prompts.",
  newcomer_follow_up:
    "A friendly follow-up to prospective members, encouraging the next conversation without pressure.",
  giving_reminder:
    "A polite Treasurer-style payment reminder that is firm, clear, and respectful.",
  pastoral_check_in:
    "A sensitive PastoralCare-style check-in. Keep it personal, gentle, and never speculative.",
  charity_appeal:
    "A positive charity update or appeal with a clear reason to support the mosque campaign.",
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
  return value === "active_members" || value === "all_members" || value === "newcomers"
    ? value
    : fallback;
}

function normalizeDraft(
  draft: Partial<CommunicationDraft>,
  category: CommunicationCategory,
  mosqueName: string
): CommunicationDraft {
  const fallback = fallbackDraft(category, mosqueName, "");
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
  mosqueName: string,
  notes: string
): CommunicationDraft {
  const label = CATEGORY_LABELS[category];
  const noteParagraph = notes
    ? `<p>${escapeHtml(notes)}</p>`
    : "<p>Please add the latest mosque details before sending.</p>";

  return {
    subject:
      category === "giving_reminder"
        ? "Reminder: mosque giving"
        : category === "newcomer_follow_up"
          ? `An update from ${mosqueName}`
          : `${mosqueName}: ${label}`,
    html_body: [
      "<p>Dear {{first_name}},</p>",
      `<p>Here is a short ${label.toLowerCase()} from ${mosqueName}.</p>`,
      noteParagraph,
      "<p>With every blessing,<br/>The Secretary</p>",
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

  const mosqueSlug = getMosqueSlugFromRequest(request);
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const forbidden = await requireAdminApiPermission("members:write", mosqueId);
  if (forbidden) return forbidden;

  const [body, mosque] = await Promise.all([
    request.json().catch(() => ({})),
    db.getMosqueById(mosqueId),
  ]);
  const category = cleanCategory(body.category);
  const notes = cleanText(body.notes);
  const eventId = cleanText(body.event_id);
  const event = eventId ? await db.getEventById(eventId, mosqueId) : null;
  const mosqueName = mosque?.name ?? "the mosque";

  const aiDraft = await completeJSON<CommunicationDraft>({
    system:
      "You draft mosque communications for admins. Reply with strict JSON: { subject: string, html_body: string, recommended_audience: 'active_members'|'all_members'|'newcomers', admin_notes: string[] }. html_body must be safe email HTML using paragraphs, headings, lists, and merge tag {{first_name}}. Do not include private ritual details, sensitive speculation, or claims of secrecy.",
    user: `Mosque: ${mosqueName}
Category: ${CATEGORY_LABELS[category]}
Audience guidance: ${CATEGORY_AUDIENCES[category]}
Content guidance: ${CATEGORY_GUIDANCE[category]}
Event: ${event ? `${event.title} on ${event.event_date}` : "None selected"}
Admin notes: ${notes || "None provided"}

Draft a ready-to-review email with a useful subject, concise body, and 2-4 admin review notes.`,
    temperature: 0.55,
  });

  const draft = aiDraft
    ? normalizeDraft(aiDraft, category, mosqueName)
    : fallbackDraft(category, mosqueName, notes);

  return NextResponse.json({
    draft,
    source: aiDraft ? "ai" : "fallback",
  });
}
