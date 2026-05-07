import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import type { LodgeSiteSectionStyle } from "@/lib/db/types";
import { sanitizeSectionStyle } from "@/lib/site-section-style";
import { requireAdminApiAuth } from "@/lib/auth/api";

type SectionType =
  | "hero"
  | "about"
  | "meeting_details"
  | "officers"
  | "charity"
  | "events"
  | "faq"
  | "join"
  | "contact";

type DraftSection = {
  id: string;
  type: SectionType;
  heading: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  visible: boolean;
  order: number;
  style?: LodgeSiteSectionStyle | null;
};

type DraftPayload = {
  page_title: string;
  page_description: string | null;
  sections: DraftSection[];
};

type DraftRequest = {
  tone?: string;
  audience?: string;
  brief?: string;
  focus?: string;
  section_type?: SectionType;
  current_section?: Partial<DraftSection>;
  /** Current page sections so hero visual settings survive full AI regen */
  existing_sections?: Array<{
    type?: string;
    style?: unknown;
  }>;
};

const SECTION_TYPES: SectionType[] = [
  "hero",
  "about",
  "meeting_details",
  "officers",
  "charity",
  "events",
  "faq",
  "join",
  "contact",
];

const TONE_PRESETS: Record<string, string> = {
  welcoming: "Warm and approachable language with clear invitations to engage.",
  formal: "Professional and respectful tone with concise, polished wording.",
  traditional: "Classic and dignified phrasing that emphasizes heritage and continuity.",
  modern: "Contemporary and direct style focused on clarity and relevance.",
  community: "People-first language that highlights belonging and local impact.",
};

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bsecret ritual(s)?\b/gi, replacement: "private lodge traditions" },
  { pattern: /\bguaranteed\b/gi, replacement: "designed to support" },
  { pattern: /\belite only\b/gi, replacement: "open to suitable applicants" },
  { pattern: /\bget rich\b/gi, replacement: "build meaningful connections" },
  { pattern: /\binstant acceptance\b/gi, replacement: "a thoughtful joining process" },
];

const ALLOWED_CTA_ROUTES = new Set([
  "/",
  "/about",
  "/events",
  "/venue",
  "/charity",
  "/faq",
  "/join",
  "/contact",
  "/news",
]);

function cleanText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function cleanNullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveToneInstruction(tone: string): string {
  const normalized = cleanText(tone, "welcoming").toLowerCase();
  return TONE_PRESETS[normalized] ?? cleanText(tone, "Warm and clear language.");
}

function sanitizeLine(text: string): string {
  let result = text.replace(/\s+/g, " ").trim();
  BLOCKED_PATTERNS.forEach(({ pattern, replacement }) => {
    result = result.replace(pattern, replacement);
  });
  return result;
}

function clamp(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}...`;
}

function sanitizeHref(href: string | null): string | null {
  if (!href) return null;
  const normalized = href.trim().toLowerCase();
  if (!normalized.startsWith("/")) return null;
  return ALLOWED_CTA_ROUTES.has(normalized) ? normalized : null;
}

function applySectionGuardrails(section: DraftSection): DraftSection {
  const { style: rawStyle, ...rest } = section;
  const style = sanitizeSectionStyle(rawStyle);
  return {
    ...rest,
    heading: clamp(sanitizeLine(section.heading), 90),
    body: section.body ? clamp(sanitizeLine(section.body), 420) : null,
    cta_label: section.cta_label ? clamp(sanitizeLine(section.cta_label), 32) : null,
    cta_href: sanitizeHref(section.cta_href),
    ...(style ? { style } : {}),
  };
}

function mergeHeroStyleFromExisting(
  draft: DraftPayload,
  existing: DraftRequest["existing_sections"]
): DraftPayload {
  if (!existing?.length) return draft;
  const style = sanitizeSectionStyle(
    existing.find((e) => e?.type === "hero")?.style
  );
  if (!style) return draft;
  return {
    ...draft,
    sections: draft.sections.map((s) =>
      s.type === "hero" ? { ...s, style } : s
    ),
  };
}

function normalizeDraft(
  payload: Partial<DraftPayload>,
  lodgeName: string,
  opts?: { sectionType?: SectionType }
): DraftPayload {
  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  const normalizedSections: DraftSection[] = sections
    .map((section, idx) => {
      const typeCandidate = opts?.sectionType ?? (typeof section?.type === "string" ? section.type : "about");
      const type = SECTION_TYPES.includes(typeCandidate as SectionType)
        ? (typeCandidate as SectionType)
        : "about";
      const preservedStyle = sanitizeSectionStyle(section?.style);
      const normalized: DraftSection = {
        id: crypto.randomUUID(),
        type,
        heading: cleanText(section?.heading, `${lodgeName} ${type.replaceAll("_", " ")}`),
        body: cleanNullableText(section?.body),
        cta_label: cleanNullableText(section?.cta_label),
        cta_href: cleanNullableText(section?.cta_href),
        visible: section?.visible !== false,
        order: idx + 1,
        ...(preservedStyle ? { style: preservedStyle } : {}),
      };
      return applySectionGuardrails(normalized);
    })
    .slice(0, 9);

  const safePageTitle = clamp(sanitizeLine(cleanText(payload.page_title, lodgeName)), 90);
  const safePageDescription = payload.page_description
    ? clamp(sanitizeLine(cleanText(payload.page_description, "")), 220)
    : null;

  return {
    page_title: safePageTitle,
    page_description: safePageDescription,
    sections:
      normalizedSections.length > 0
        ? normalizedSections
        : buildFallbackDraft({
            lodgeName,
            lodgeCity: null,
            tone: "welcoming",
            audience: "prospective members",
            brief: "",
            focus: "",
            sectionType: opts?.sectionType,
          }).sections,
  };
}

function buildFallbackDraft(input: {
  lodgeName: string;
  lodgeCity: string | null;
  tone: string;
  audience: string;
  brief: string;
  focus: string;
  sectionType?: SectionType;
}): DraftPayload {
  const cityFragment = input.lodgeCity ? ` in ${input.lodgeCity}` : "";
  const toneWord = input.tone || "welcoming";
  const audienceWord = input.audience || "prospective members";
  const briefSentence = input.brief
    ? ` ${input.brief.trim().replace(/\.$/, "")}.`
    : " A lodge rooted in fellowship, integrity, and service.";
  const focusSentence = input.focus
    ? ` Key focus: ${input.focus.trim().replace(/\.$/, "")}.`
    : "";

  const templates: Record<SectionType, Omit<DraftSection, "id" | "order">> = {
    hero: {
      type: "hero",
      heading: `Welcome to ${input.lodgeName}${cityFragment}`,
      body: `${input.lodgeName} offers a ${toneWord} introduction to lodge life for ${audienceWord}.${briefSentence}${focusSentence}`,
      cta_label: "Express Interest",
      cta_href: "/join",
      visible: true,
    },
    about: {
      type: "about",
      heading: "About the lodge",
      body: `${input.lodgeName} brings members together through regular meetings, friendship, and meaningful charitable action.`,
      cta_label: "Learn More",
      cta_href: "/about",
      visible: true,
    },
    meeting_details: {
      type: "meeting_details",
      heading: "Meetings and events",
      body: "Discover upcoming lodge meetings, social dinners, and charitable gatherings.",
      cta_label: "View Events",
      cta_href: "/events",
      visible: true,
    },
    officers: {
      type: "officers",
      heading: "Lodge officers",
      body: "Meet the officers who help guide the lodge and support members throughout the year.",
      cta_label: "Meet the Team",
      cta_href: "/about",
      visible: true,
    },
    charity: {
      type: "charity",
      heading: "Charity and community impact",
      body: "Our members support local and national causes through fundraising and ongoing contributions.",
      cta_label: "Charity Work",
      cta_href: "/charity",
      visible: true,
    },
    events: {
      type: "events",
      heading: "Upcoming events",
      body: "Browse upcoming meetings and gatherings, with clear details and RSVP options.",
      cta_label: "Upcoming Events",
      cta_href: "/events",
      visible: true,
    },
    faq: {
      type: "faq",
      heading: "Questions about joining",
      body: "Get clear answers on eligibility, expectations, and what the joining process looks like.",
      cta_label: "Read FAQs",
      cta_href: "/faq",
      visible: true,
    },
    join: {
      type: "join",
      heading: "Ready to enquire?",
      body: "Start with a short expression of interest and the lodge team will guide you through next steps.",
      cta_label: "Start Enquiry",
      cta_href: "/join",
      visible: true,
    },
    contact: {
      type: "contact",
      heading: "Get in touch",
      body: "Speak with the lodge team directly to ask questions or request a conversation.",
      cta_label: "Contact Us",
      cta_href: "/contact",
      visible: true,
    },
  };

  const sectionOrder: SectionType[] = input.sectionType
    ? [input.sectionType]
    : ["hero", "about", "meeting_details", "charity", "faq", "contact"];

  const sections: DraftSection[] = sectionOrder.map((type, idx) =>
    applySectionGuardrails({
      id: crypto.randomUUID(),
      order: idx + 1,
      ...templates[type],
    })
  );

  return {
    page_title: clamp(sanitizeLine(input.lodgeName), 90),
    page_description: clamp(sanitizeLine(`A ${toneWord} lodge website for ${audienceWord}.`), 220),
    sections,
  };
}

async function tryOpenAIDraft(input: {
  lodgeName: string;
  lodgeCity: string | null;
  tone: string;
  audience: string;
  brief: string;
  focus: string;
  sectionType?: SectionType;
  currentSection?: Partial<DraftSection>;
}): Promise<DraftPayload | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt =
    "You generate structured draft content for lodge websites. Return JSON only with keys: page_title, page_description, sections. sections is an array of objects with keys: type, heading, body, cta_label, cta_href, visible. Allowed section types: hero, about, meeting_details, officers, charity, events, faq, join, contact.";

  const modeNote = input.sectionType
    ? `Mode: regenerate one section only. The only section type allowed is ${input.sectionType}.`
    : "Mode: full one-page draft.";
  const currentSectionNote = input.currentSection
    ? `Current section to improve:
Type: ${input.currentSection.type ?? input.sectionType ?? "about"}
Heading: ${input.currentSection.heading ?? ""}
Body: ${input.currentSection.body ?? ""}
CTA label: ${input.currentSection.cta_label ?? ""}
CTA href: ${input.currentSection.cta_href ?? ""}`
    : "Current section: none provided.";

  const userPrompt = `Generate a polished one-page website draft.
Lodge: ${input.lodgeName}
City: ${input.lodgeCity ?? "Unknown"}
Tone: ${input.tone}
Tone guidance: ${resolveToneInstruction(input.tone)}
Audience: ${input.audience}
Brief: ${input.brief || "None provided"}
Focus: ${input.focus || "None provided"}
${modeNote}
${currentSectionNote}

Requirements:
- ${input.sectionType ? "Exactly 1 section." : "5 to 7 sections."}
- ${input.sectionType ? `Section must be ${input.sectionType}.` : "Include hero, about, meeting_details, and contact."}
- Keep copy concise and clear
- Use realistic CTAs and links like /join, /events, /contact
- Avoid claims of secrecy, guarantees, or exclusionary language
- Output valid JSON only`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const completion = await res.json();
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = JSON.parse(content) as Partial<DraftPayload>;
    return normalizeDraft(parsed, input.lodgeName, { sectionType: input.sectionType });
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { slug } = await params;
    const lodgeSlug = resolveLodgeSlug(slug);
    const lodge = isSupabaseConfigured()
      ? await db.getLodgeBySlug(lodgeSlug)
      : mockDb.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as DraftRequest;
    const tone = cleanText(body.tone, "welcoming");
    const audience = cleanText(body.audience, "prospective members");
    const brief = cleanText(body.brief, "");
    const focus = cleanText(body.focus, "");
    const sectionType = SECTION_TYPES.includes(body.section_type as SectionType)
      ? (body.section_type as SectionType)
      : undefined;

    let aiDraft =
      (await tryOpenAIDraft({
        lodgeName: lodge.name,
        lodgeCity: lodge.city,
        tone,
        audience,
        brief,
        focus,
        sectionType,
        currentSection: body.current_section,
      })) ??
      buildFallbackDraft({
        lodgeName: lodge.name,
        lodgeCity: lodge.city,
        tone,
        audience,
        brief,
        focus,
        sectionType,
      });

    aiDraft = mergeHeroStyleFromExisting(aiDraft, body.existing_sections);

    if (sectionType) {
      return NextResponse.json({
        success: true,
        section: aiDraft.sections[0],
        source: process.env.OPENAI_API_KEY ? "ai_or_fallback" : "fallback",
      });
    }

    return NextResponse.json({
      success: true,
      draft: aiDraft,
      source: process.env.OPENAI_API_KEY ? "ai_or_fallback" : "fallback",
    });
  } catch (error) {
    console.error("Lodge AI draft error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

