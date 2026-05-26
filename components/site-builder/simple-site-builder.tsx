"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  LayoutTemplate,
  Loader2,
  MousePointerClick,
  Pencil,
  Plus,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Wand2,
  ExternalLink,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LodgeSiteSection } from "@/lib/db/types";
import { SitePreview } from "./site-preview";
import { PuckEditor } from "./puck-editor";
import { ImageUploadField } from "./image-upload-field";
import {
  buildTemplateSitePack,
  SECTION_VARIANTS,
  TEMPLATES,
} from "@/lib/site-builder/templates";
import type {
  LodgeSiteCustomPage,
  LodgeSiteFooterSettings,
  LodgeSiteHeaderSettings,
} from "@/lib/db/types";

type Step = "template" | "edit" | "preview" | "publish";
type WebsiteAiMode = "full" | "improve" | "add";
type WebsiteAiDraft = {
  page_title: string;
  page_description: string | null;
  sections: LodgeSiteSection[];
};

const SECTION_LABELS: Record<LodgeSiteSection["type"], string> = {
  hero: "Hero",
  about: "About",
  meeting_details: "Meeting times",
  officers: "Officers",
  charity: "Charity",
  events: "Upcoming meetings",
  faq: "FAQ",
  join: "Join",
  contact: "Contact",
};

const STEPS: { id: Step; label: string }[] = [
  { id: "template", label: "Choose site" },
  { id: "edit", label: "Personalise" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

const LAUNCH_GUIDE = [
  {
    id: "template" as const,
    icon: LayoutTemplate,
    title: "Pick a complete site",
    body: "Start from a polished lodge website with pages, header, footer, images, and forms already wired.",
  },
  {
    id: "edit" as const,
    icon: MousePointerClick,
    title: "Change words and images",
    body: "Edit headings, text, calls to action, and photos without touching layout code.",
  },
  {
    id: "preview" as const,
    icon: ImageIcon,
    title: "Check the live look",
    body: "Preview desktop, tablet, and phone before anything goes public.",
  },
  {
    id: "publish" as const,
    icon: Rocket,
    title: "Go live",
    body: "Save, publish, and then connect the lodge domain from the launch checklist.",
  },
];

const FORM_FIELD_OPTIONS = [
  { id: "phone", label: "Phone" },
  { id: "subject", label: "Subject" },
  { id: "location", label: "Location" },
  { id: "how_heard", label: "How heard" },
  { id: "message", label: "Message" },
  { id: "consent", label: "Consent checkbox" },
] as const;

export function SimpleSiteBuilder({
  lodgeSlug,
  initialSections,
  pageTitle: initialPageTitle,
  pageDescription: initialPageDescription,
  primaryColor = "#3b82f6",
  initiallyPublished,
  publicHref,
  title = "Lodge website builder",
  description = "Pick a template, edit sections in friendly forms, preview, and publish when ready.",
  onPersist,
}: {
  lodgeSlug: string;
  initialSections: LodgeSiteSection[];
  pageTitle: string;
  pageDescription: string | null;
  primaryColor?: string;
  initiallyPublished: boolean;
  publicHref: string;
  title?: string;
  description?: string;
  onPersist?: (payload: {
    page_title: string;
    page_description: string | null;
    sections: LodgeSiteSection[];
    custom_pages?: LodgeSiteCustomPage[];
    header_settings?: LodgeSiteHeaderSettings;
    footer_settings?: LodgeSiteFooterSettings;
    published?: boolean;
  }) => Promise<void>;
}) {
  const isFullSiteBuilder = !onPersist;
  const [step, setStep] = useState<Step>(
    initialSections.length === 0 ? "template" : "edit"
  );
  const [advanced, setAdvanced] = useState(false);
  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  const [pageDescription, setPageDescription] = useState(
    initialPageDescription ?? ""
  );
  const [sections, setSections] = useState<LodgeSiteSection[]>(initialSections);
  const [published, setPublished] = useState(initiallyPublished);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [websiteAiMode, setWebsiteAiMode] = useState<WebsiteAiMode>("full");
  const [websiteAiSectionId, setWebsiteAiSectionId] = useState("");
  const [websiteAiSectionType, setWebsiteAiSectionType] =
    useState<LodgeSiteSection["type"]>("about");
  const [websiteAiTone, setWebsiteAiTone] = useState("welcoming");
  const [websiteAiAudience, setWebsiteAiAudience] = useState("prospective members");
  const [websiteAiBrief, setWebsiteAiBrief] = useState("");
  const [websiteAiFocus, setWebsiteAiFocus] = useState("");
  const [websiteAiDraft, setWebsiteAiDraft] = useState<WebsiteAiDraft | null>(null);
  const [websiteAiMessage, setWebsiteAiMessage] = useState<string | null>(null);
  const [websiteAiBusy, setWebsiteAiBusy] = useState(false);

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const flash = useCallback((msg: string, type: "success" | "error") => {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 4000);
  }, []);

  const orderedSections = useMemo(
    () =>
      sections
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s, i) => ({ ...s, order: i + 1 })),
    [sections]
  );

  async function savePayload(
    payload: {
      page_title: string;
      page_description: string | null;
      sections: LodgeSiteSection[];
      custom_pages?: LodgeSiteCustomPage[];
      header_settings?: LodgeSiteHeaderSettings;
      footer_settings?: LodgeSiteFooterSettings;
      published?: boolean;
    },
    message = "Saved."
  ) {
    setSaving(true);
    try {
      if (onPersist) {
        await onPersist(payload);
      } else {
        const res = await fetch(`/api/lodges/${lodgeSlug}/site`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("save failed");
      }
      flash(message, "success");
      if (payload.published !== undefined) setPublished(payload.published);
      return true;
    } catch {
      flash("Could not save changes.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function applyTemplate(templateId: string) {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const nextSections = tpl
      .buildSections()
      .sort((a, b) => a.order - b.order)
      .map((section, index) => ({ ...section, order: index + 1 }));
    const sitePack = onPersist ? null : buildTemplateSitePack(tpl);
    setSections(nextSections);
    setStep("preview");
    await savePayload(
      {
        page_title: pageTitle,
        page_description: pageDescription || null,
        sections: nextSections,
        ...(sitePack ?? {}),
      },
      sitePack
        ? `${tpl.name} site pack applied: homepage, pages, header, footer, and draft saved.`
        : `${tpl.name} template applied and saved as a draft.`
    );
  }

  function updateSection(id: string, patch: Partial<LodgeSiteSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function updateSectionStyle(
    id: string,
    patch: NonNullable<LodgeSiteSection["style"]>
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const nextStyle = { ...(s.style ?? {}), ...patch };
        Object.keys(nextStyle).forEach((key) => {
          const value = nextStyle[key as keyof typeof nextStyle];
          if (value === "" || value === null) {
            delete nextStyle[key as keyof typeof nextStyle];
          }
        });
        return {
          ...s,
          style: Object.keys(nextStyle).length > 0 ? nextStyle : null,
        };
      })
    );
  }

  function toggleStyleArrayValue(
    id: string,
    key: "form_fields" | "form_required_fields",
    value: string,
    checked: boolean
  ) {
    const section = sections.find((s) => s.id === id);
    const current = Array.isArray(section?.style?.[key])
      ? section?.style?.[key] ?? []
      : [];
    const next = checked
      ? Array.from(new Set([...current, value]))
      : current.filter((item) => item !== value);
    updateSectionStyle(id, { [key]: next.length > 0 ? next : null });
  }

  function updateFaqEntries(
    id: string,
    mutate: (
      entries: { question: string; answer: string }[]
    ) => { question: string; answer: string }[]
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const current = Array.isArray(s.style?.faq_entries)
          ? s.style?.faq_entries ?? []
          : [];
        const next = mutate(current.map((e) => ({ ...e })));
        const nextStyle = { ...(s.style ?? {}) };
        if (next.length === 0) {
          delete nextStyle.faq_entries;
        } else {
          nextStyle.faq_entries = next;
        }
        return {
          ...s,
          style: Object.keys(nextStyle).length > 0 ? nextStyle : null,
        };
      })
    );
  }

  function moveSection(id: string, direction: -1 | 1) {
    setSections((prev) => {
      const sorted = prev.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((s) => s.id === id);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= sorted.length) return prev;
      const next = sorted.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  function removeSection(id: string) {
    setSections((prev) => prev.filter((s) => s.id !== id));
  }

  function addSectionVariant(variantId: string) {
    const preset = SECTION_VARIANTS.find((p) => p.id === variantId);
    if (!preset) return;
    const next = preset.example();
    setSections((prev) => [...prev, { ...next, order: prev.length + 1 }]);
    setShowAddPanel(false);
    setEditingId(next.id);
  }

  async function persist(opts: { nextPublished?: boolean } = {}) {
    await savePayload({
      page_title: pageTitle,
      page_description: pageDescription || null,
      sections: orderedSections,
      ...(opts.nextPublished !== undefined
        ? { published: opts.nextPublished }
        : {}),
    });
  }

  async function togglePublish(nextPublished: boolean) {
    setPublishing(true);
    await persist({ nextPublished });
    setPublishing(false);
  }

  async function draftWebsiteWithAi() {
    setWebsiteAiBusy(true);
    setWebsiteAiMessage(null);
    try {
      const selectedSection = orderedSections.find(
        (section) => section.id === websiteAiSectionId
      );
      const sectionType =
        websiteAiMode === "full"
          ? undefined
          : websiteAiMode === "improve"
            ? selectedSection?.type
            : websiteAiSectionType;
      const res = await fetch(`/api/lodges/${lodgeSlug}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: websiteAiTone,
          audience: websiteAiAudience,
          brief: websiteAiBrief,
          focus: websiteAiFocus,
          section_type: sectionType,
          current_section: websiteAiMode === "improve" ? selectedSection : undefined,
          existing_sections: orderedSections.map((section) => ({
            type: section.type,
            style: section.style,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not draft website content.");
      const draft =
        websiteAiMode === "full"
          ? data.draft
          : {
              page_title: pageTitle,
              page_description: pageDescription || null,
              sections: [data.section],
            };
      setWebsiteAiDraft(draft);
      setWebsiteAiMessage(
        data.source === "fallback"
          ? "Fallback website draft ready to review."
          : "AI website draft ready to review."
      );
    } catch (error) {
      setWebsiteAiMessage(
        error instanceof Error ? error.message : "Could not draft website content."
      );
    } finally {
      setWebsiteAiBusy(false);
    }
  }

  function applyWebsiteAiDraft() {
    if (!websiteAiDraft) return;
    if (websiteAiMode === "full") {
      setPageTitle(websiteAiDraft.page_title);
      setPageDescription(websiteAiDraft.page_description ?? "");
      setSections(
        websiteAiDraft.sections.map((section, index) => ({
          ...section,
          order: index + 1,
        }))
      );
      setStep("preview");
      setWebsiteAiMessage("AI homepage draft applied. Save or edit before publishing.");
      return;
    }

    const draftedSection = websiteAiDraft.sections[0];
    if (!draftedSection) return;

    if (websiteAiMode === "improve") {
      const selectedSection = orderedSections.find(
        (section) => section.id === websiteAiSectionId
      );
      if (!selectedSection) {
        setWebsiteAiMessage("Choose a section to improve first.");
        return;
      }
      setSections((prev) =>
        prev.map((section) =>
          section.id === selectedSection.id
            ? {
                ...section,
                heading: draftedSection.heading,
                body: draftedSection.body,
                cta_label: draftedSection.cta_label,
                cta_href: draftedSection.cta_href,
                visible: draftedSection.visible,
                style: draftedSection.style ?? section.style,
              }
            : section
        )
      );
      setEditingId(selectedSection.id);
      setStep("edit");
      setWebsiteAiMessage("AI section rewrite applied. Review and save the draft.");
      return;
    }

    const nextSection = {
      ...draftedSection,
      id: crypto.randomUUID(),
      order: orderedSections.length + 1,
    };
    setSections((prev) => [...prev, nextSection]);
    setEditingId(nextSection.id);
    setStep("edit");
    setWebsiteAiMessage("AI section added. Review and save the draft.");
  }

  function updateWebsiteAiDraft(patch: Partial<WebsiteAiDraft>) {
    setWebsiteAiDraft((draft) => (draft ? { ...draft, ...patch } : draft));
  }

  function updateWebsiteAiDraftSection(
    index: number,
    patch: Partial<LodgeSiteSection>
  ) {
    setWebsiteAiDraft((draft) =>
      draft
        ? {
            ...draft,
            sections: draft.sections.map((section, sectionIndex) =>
              sectionIndex === index ? { ...section, ...patch } : section
            ),
          }
        : draft
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-dash-text">
            <Sparkles className="h-5 w-5 text-amber-600" />
            {title}
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              published
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900"
            )}
          >
            {published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {published ? "Published" : "Draft only"}
          </span>
          <Button asChild variant="dashboard" size="sm">
            <a href={publicHref} target="_blank" rel="noreferrer" className="gap-2">
              View published site <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

      {isFullSiteBuilder ? (
        <div className="overflow-hidden rounded-3xl border border-dash-border bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-dash">
          <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr] lg:p-8">
            <div>
              <span className="inline-flex rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                Website launch assistant
              </span>
              <h3 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
                Build a lodge website in minutes, then only tweak what matters.
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                The builder now starts from complete site packs. Non-technical admins can choose a design, replace a few words and images, preview it, and publish with confidence.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStep("template")}
                  className="rounded-xl bg-white text-slate-950 hover:bg-slate-100"
                >
                  Choose a site pack
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(orderedSections.length ? "preview" : "template")}
                  className="rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                >
                  Preview current draft
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {LAUNCH_GUIDE.map((item, index) => {
                const Icon = item.icon;
                const active = item.id === step;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStep(item.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-white/30 bg-white/15"
                        : "border-white/10 bg-white/[0.06] hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-950">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Step {index + 1}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.body}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h3 className="dash-panel-header-title">AI website assistant</h3>
            <p className="dash-panel-header-description">
              Draft a full homepage, rewrite one section, or add a new block. AI changes stay in draft until you apply and save them.
            </p>
          </div>
          <Sparkles className="h-5 w-5 text-amber-600" />
        </div>
        <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-5">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">AI task</label>
              <select
                value={websiteAiMode}
                onChange={(event) => {
                  setWebsiteAiMode(event.target.value as WebsiteAiMode);
                  setWebsiteAiDraft(null);
                  setWebsiteAiMessage(null);
                }}
                className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
              >
                <option value="full">Draft full homepage</option>
                <option value="improve">Improve selected section</option>
                <option value="add">Add a new section</option>
              </select>
            </div>
            {websiteAiMode === "improve" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">
                  Section to improve
                </label>
                <select
                  value={websiteAiSectionId}
                  onChange={(event) => setWebsiteAiSectionId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="">Choose a section</option>
                  {orderedSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {SECTION_LABELS[section.type]}: {section.heading}
                    </option>
                  ))}
                </select>
              </div>
            ) : websiteAiMode === "add" ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">
                  New section type
                </label>
                <select
                  value={websiteAiSectionType}
                  onChange={(event) =>
                    setWebsiteAiSectionType(
                      event.target.value as LodgeSiteSection["type"]
                    )
                  }
                  className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                >
                  {Object.entries(SECTION_LABELS).map(([type, label]) => (
                    <option key={type} value={type}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">Tone</label>
                <select
                  value={websiteAiTone}
                  onChange={(event) => setWebsiteAiTone(event.target.value)}
                  className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="welcoming">Welcoming</option>
                  <option value="formal">Formal</option>
                  <option value="traditional">Traditional</option>
                  <option value="modern">Modern</option>
                  <option value="community">Community</option>
                </select>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">Audience</label>
              <Input
                value={websiteAiAudience}
                onChange={(event) => setWebsiteAiAudience(event.target.value)}
                placeholder="prospective members"
              />
            </div>
          </div>
          {websiteAiMode !== "full" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">Tone</label>
                <select
                  value={websiteAiTone}
                  onChange={(event) => setWebsiteAiTone(event.target.value)}
                  className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                >
                  <option value="welcoming">Welcoming</option>
                  <option value="formal">Formal</option>
                  <option value="traditional">Traditional</option>
                  <option value="modern">Modern</option>
                  <option value="community">Community</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">Focus</label>
                <Input
                  value={websiteAiFocus}
                  onChange={(event) => setWebsiteAiFocus(event.target.value)}
                  placeholder="e.g. visiting officers, charity, joining, dining"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">Focus</label>
              <Input
                value={websiteAiFocus}
                onChange={(event) => setWebsiteAiFocus(event.target.value)}
                placeholder="e.g. visiting officers, charity, joining, dining"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dash-muted">Brief</label>
            <Textarea
              rows={3}
              value={websiteAiBrief}
              onChange={(event) => setWebsiteAiBrief(event.target.value)}
              placeholder="Tell AI what the lodge wants to say publicly."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={draftWebsiteWithAi}
              disabled={
                websiteAiBusy ||
                (websiteAiMode === "improve" && !websiteAiSectionId)
              }
              className="gap-2"
            >
              {websiteAiBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              Draft with AI
            </Button>
            <Button
              type="button"
              variant="dashboard"
              onClick={applyWebsiteAiDraft}
              disabled={!websiteAiDraft}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Apply to draft
            </Button>
          </div>
          {websiteAiMessage ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
              {websiteAiMessage}
            </div>
          ) : null}
          {websiteAiDraft ? (
            <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-muted">
                Draft preview
              </p>
              {websiteAiMode === "full" ? (
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-dash-muted">
                      Page title
                    </label>
                    <Input
                      value={websiteAiDraft.page_title}
                      onChange={(event) =>
                        updateWebsiteAiDraft({ page_title: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-dash-muted">
                      SEO description
                    </label>
                    <Input
                      value={websiteAiDraft.page_description ?? ""}
                      onChange={(event) =>
                        updateWebsiteAiDraft({
                          page_description: event.target.value || null,
                        })
                      }
                    />
                  </div>
                </div>
              ) : null}
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {websiteAiDraft.sections.map((section, index) => (
                  <div
                    key={`${section.type}-${index}`}
                    className="space-y-3 rounded-xl border border-dash-border bg-white p-3 text-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
                      {SECTION_LABELS[section.type]}
                    </p>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-dash-muted">
                        Heading
                      </label>
                      <Input
                        value={section.heading}
                        onChange={(event) =>
                          updateWebsiteAiDraftSection(index, {
                            heading: event.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-dash-muted">
                        Body
                      </label>
                      <Textarea
                        rows={4}
                        value={section.body ?? ""}
                        onChange={(event) =>
                          updateWebsiteAiDraftSection(index, {
                            body: event.target.value || null,
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-dash-muted">
                          CTA label
                        </label>
                        <Input
                          value={section.cta_label ?? ""}
                          onChange={(event) =>
                            updateWebsiteAiDraftSection(index, {
                              cta_label: event.target.value || null,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-dash-muted">
                          CTA path
                        </label>
                        <Input
                          value={section.cta_href ?? ""}
                          onChange={(event) =>
                            updateWebsiteAiDraftSection(index, {
                              cta_href: event.target.value || null,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const done = STEPS.findIndex((x) => x.id === step) > i;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-dash-ring bg-dash-ring/10 text-dash-ring"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : "border-dash-border bg-dash-surface text-dash-muted hover:border-dash-border-strong hover:text-dash-text"
              )}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold">
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <Button
            variant="dashboard"
            size="sm"
            onClick={() => setAdvanced((v) => !v)}
            className="gap-2"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {advanced ? "Simple editor" : "Advanced controls"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => persist()}
            disabled={saving}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save draft
          </Button>
        </div>
      </div>

      {step === "template" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h3 className="dash-panel-header-title">Choose a starting template</h3>
              <p className="dash-panel-header-description">
                {isFullSiteBuilder
                  ? "Pick one complete site. The homepage, extra pages, header, footer, images, and forms are set up for you."
                  : "Pick the layout closest to this page. You can rearrange and edit anything afterwards."}
              </p>
            </div>
          </div>
          <CardContent className="grid gap-5 border-t border-dash-border bg-dash-surface p-5 xl:grid-cols-2">
            {TEMPLATES.map((t) => {
              const previewSections = t.buildSections();
              const accent = t.accent ?? primaryColor;
              const heroImage = previewSections[0]?.style?.background_image_url;
              const heroPosition =
                previewSections[0]?.style?.background_position ?? "center";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  disabled={saving}
                  className="group overflow-hidden rounded-3xl border border-dash-border bg-dash-surface-subtle/40 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-dash-ring/60 hover:bg-dash-surface hover:shadow-dash"
                >
                  <div
                    className="h-2"
                    style={{ background: `linear-gradient(90deg, ${accent}, ${accent}55)` }}
                  />
                  <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-dash-border bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-dash-muted">
                          {t.category ?? "Template"}
                        </span>
                        {(t.tags ?? []).slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-dash-ring/10 px-2.5 py-1 text-[11px] font-medium text-dash-ring"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-dash-text group-hover:text-dash-ring">
                          {t.name}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-dash-muted">
                          {t.description}
                        </p>
                      </div>
                      {t.bestFor ? (
                        <p className="rounded-xl border border-dash-border bg-white/70 px-3 py-2 text-xs text-dash-muted">
                          Best for: {t.bestFor}
                        </p>
                      ) : null}
                      {isFullSiteBuilder ? (
                        <div className="grid gap-2 rounded-xl border border-dash-border bg-white/80 p-3 text-xs text-dash-muted sm:grid-cols-2">
                          <span>Includes homepage and 4 pages</span>
                          <span>Pre-built header and footer</span>
                          <span>Contact form to lodge admins</span>
                          <span>Join form to lead pipeline</span>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-1.5">
                        {previewSections.slice(0, 6).map((s, index) => (
                          <span
                            key={`${t.id}-${s.type}-${index}`}
                            className="rounded-full border border-dash-border bg-white px-2 py-0.5 text-[11px] text-dash-muted"
                          >
                            {SECTION_LABELS[s.type]}
                          </span>
                        ))}
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-dash-ring">
                        {saving
                          ? "Applying template..."
                          : isFullSiteBuilder
                            ? "Apply site pack, save draft, and preview"
                            : "Apply, save draft, and preview"}{" "}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <div className="rounded-3xl border border-dash-border bg-white p-2 shadow-inner">
                      <div
                        className="relative overflow-hidden rounded-2xl px-4 py-8 text-center text-white"
                        style={{
                          background: `linear-gradient(135deg, ${accent}, #0f172a)`,
                        }}
                      >
                        {heroImage ? (
                          <>
                            <div
                              className="absolute inset-0 bg-cover bg-center"
                              style={{
                                backgroundImage: `url("${heroImage}")`,
                                backgroundPosition: heroPosition,
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-950/55" />
                          </>
                        ) : null}
                        <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                          Hero
                        </p>
                        <p className="relative mt-2 line-clamp-2 text-sm font-semibold">
                          {previewSections[0]?.heading ?? t.name}
                        </p>
                        <div className="relative mx-auto mt-4 h-1.5 w-20 rounded-full bg-white/40" />
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {previewSections.slice(1, 5).map((s, index) => (
                          <div
                            key={`${t.id}-preview-${s.type}-${index}`}
                            className="flex items-center gap-2 rounded-xl bg-slate-50 px-2 py-2"
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: accent }}
                            />
                            <span className="truncate text-[11px] text-slate-600">
                              {SECTION_LABELS[s.type]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </CardContent>
          <div className="flex justify-between border-t border-dash-border bg-dash-surface-subtle p-4">
            <span className="text-xs text-dash-muted">
              Already happy with your sections? Skip this step.
            </span>
            <Button variant="dashboard" size="sm" onClick={() => setStep("edit")}>
              Skip <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}

      {step === "edit" && (
        <div className="space-y-5">
          <Card variant="panel" className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">
                  Page title
                </label>
                <Input
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                  placeholder="e.g. Covenant Lodge No. 4344"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-dash-muted">
                  Page description (SEO)
                </label>
                <Input
                  value={pageDescription}
                  onChange={(e) => setPageDescription(e.target.value)}
                  placeholder="A short summary for search engines"
                />
              </div>
            </div>
          </Card>

          {advanced ? (
            <Card variant="panel" className="overflow-hidden p-0">
              <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
                <div>
                  <h3 className="dash-panel-header-title">Advanced editor</h3>
                  <p className="dash-panel-header-description">
                    Drag-and-drop layout editor with full control.
                  </p>
                </div>
              </div>
              <PuckEditor
                lodgeSlug={lodgeSlug}
                initialSections={orderedSections}
                pageTitle={pageTitle}
                pageDescription={pageDescription}
                primaryColor={primaryColor}
              />
            </Card>
          ) : (
            <Card variant="panel" className="overflow-hidden p-0">
              <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
                <div>
                  <h3 className="dash-panel-header-title">Personalise your site</h3>
                  <p className="dash-panel-header-description">
                    Replace the words and images. The layout is already handled by the selected site pack.
                  </p>
                </div>
                <Button
                  variant="dashboard"
                  size="sm"
                  onClick={() => setShowAddPanel((v) => !v)}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add section
                </Button>
              </div>

              {showAddPanel && (
                <div className="border-t border-dash-border bg-dash-surface-subtle p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-dash-text">
                        Section variant library
                      </p>
                      <p className="text-xs text-dash-muted">
                        Add polished blocks with sensible layout, CTA, image, and form defaults.
                      </p>
                    </div>
                    <span className="rounded-full border border-dash-border bg-white px-2.5 py-1 text-xs text-dash-muted">
                      {SECTION_VARIANTS.length} variants
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {SECTION_VARIANTS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addSectionVariant(p.id)}
                      className="flex min-h-32 flex-col items-start gap-2 rounded-xl border border-dash-border bg-white p-3 text-left text-sm transition hover:border-dash-ring/50 hover:bg-dash-surface hover:shadow-sm"
                    >
                      <div className="flex w-full flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-dash-border bg-dash-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-dash-muted">
                          {SECTION_LABELS[p.type]}
                        </span>
                        <span className="rounded-full bg-dash-ring/10 px-2 py-0.5 text-[10px] font-medium capitalize text-dash-ring">
                          {p.tone}
                        </span>
                      </div>
                      <span className="font-medium text-dash-text">{p.label}</span>
                      <span className="line-clamp-2 text-xs text-dash-muted">
                        {p.description}
                      </span>
                      <div className="mt-auto flex flex-wrap gap-1">
                        {p.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                  </div>
                </div>
              )}

              {orderedSections.length > 0 ? (
                <div className="border-t border-dash-border bg-slate-950 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Draft preview while editing</p>
                      <p className="text-xs text-slate-400">
                        Keep this open while changing sections below.
                      </p>
                    </div>
                    <Button asChild type="button" variant="secondary" size="sm" className="rounded-xl">
                      <a href={publicHref} target="_blank" rel="noreferrer">
                        Preview in new tab
                        <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  </div>
                  <div className="h-[520px] overflow-hidden rounded-2xl border border-white/10">
                    <SitePreview
                      sections={orderedSections}
                      pageTitle={pageTitle}
                      pageDescription={pageDescription || null}
                      primaryColor={primaryColor}
                    />
                  </div>
                </div>
              ) : null}

              <CardContent className="border-t border-dash-border bg-dash-surface p-0">
                {orderedSections.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-dash-muted">
                    No sections yet. Add one above or pick a template.
                  </p>
                ) : (
                  <ul className="divide-y divide-dash-border">
                    {orderedSections.map((s, idx) => (
                      <li key={s.id} className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col items-center gap-1 pt-1 text-dash-muted">
                            <button
                              type="button"
                              onClick={() => moveSection(s.id, -1)}
                              disabled={idx === 0}
                              className="rounded-md p-1 hover:bg-dash-surface-subtle disabled:opacity-40"
                              aria-label="Move up"
                            >
                              <ChevronLeft className="h-4 w-4 -rotate-90" />
                            </button>
                            <GripVertical className="h-4 w-4 opacity-50" />
                            <button
                              type="button"
                              onClick={() => moveSection(s.id, 1)}
                              disabled={idx === orderedSections.length - 1}
                              className="rounded-md p-1 hover:bg-dash-surface-subtle disabled:opacity-40"
                              aria-label="Move down"
                            >
                              <ChevronRight className="h-4 w-4 -rotate-90" />
                            </button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-dash-border bg-dash-surface-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-dash-muted">
                                {SECTION_LABELS[s.type]}
                              </span>
                              <h4 className="truncate font-medium text-dash-text">
                                {s.heading || "Untitled"}
                              </h4>
                              {!s.visible && (
                                <span className="text-xs text-dash-muted">(hidden)</span>
                              )}
                            </div>
                            {s.body && (
                              <p className="mt-1 text-sm text-dash-muted line-clamp-2">
                                {s.body}
                              </p>
                            )}
                            {editingId === s.id && (
                              <div className="mt-3 space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-dash-muted">
                                    Heading
                                  </label>
                                  <Input
                                    value={s.heading}
                                    onChange={(e) =>
                                      updateSection(s.id, { heading: e.target.value })
                                    }
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-dash-muted">
                                    Body
                                  </label>
                                  <Textarea
                                    rows={3}
                                    value={s.body ?? ""}
                                    onChange={(e) =>
                                      updateSection(s.id, { body: e.target.value || null })
                                    }
                                  />
                                </div>
                                <div className="grid gap-3 lg:grid-cols-2">
                                  <ImageUploadField
                                    label="Section image"
                                    value={s.style?.image_url ?? ""}
                                    onChange={(value) =>
                                      updateSectionStyle(s.id, { image_url: value || null })
                                    }
                                    onClear={() =>
                                      updateSectionStyle(s.id, { image_url: null })
                                    }
                                    help="Adds a polished visual inside this section."
                                  />
                                  <ImageUploadField
                                    label={
                                      s.type === "hero"
                                        ? "Hero background image"
                                        : "Section background image"
                                    }
                                    value={s.style?.background_image_url ?? ""}
                                    onChange={(value) =>
                                      updateSectionStyle(s.id, {
                                        background_image_url: value || null,
                                      })
                                    }
                                    onClear={() =>
                                      updateSectionStyle(s.id, {
                                        background_image_url: null,
                                      })
                                    }
                                    help="Use this for full-width image backgrounds and hero-style impact."
                                  />
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Image alt text
                                    </label>
                                    <Input
                                      value={s.style?.image_alt ?? ""}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          image_alt: e.target.value || null,
                                        })
                                      }
                                      placeholder="Describe the image"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Image placement
                                    </label>
                                    <select
                                      value={s.style?.image_position ?? "right"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          image_position: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["image_position"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="right">Right</option>
                                      <option value="left">Left</option>
                                      <option value="top">Top</option>
                                      <option value="bottom">Bottom</option>
                                      <option value="full">Full width</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Image shape
                                    </label>
                                    <select
                                      value={s.style?.image_shape ?? "rounded"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          image_shape: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["image_shape"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="rounded">Rounded</option>
                                      <option value="square">Square</option>
                                      <option value="circle">Circle</option>
                                      <option value="arch">Arch</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-4">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Background tone
                                    </label>
                                    <select
                                      value={s.style?.background_tone ?? "default"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          background_tone: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["background_tone"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="default">Default</option>
                                      <option value="soft">Soft</option>
                                      <option value="brand">Brand tint</option>
                                      <option value="dark">Dark</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Content width
                                    </label>
                                    <select
                                      value={s.style?.content_width ?? "standard"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          content_width: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["content_width"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="narrow">Narrow</option>
                                      <option value="standard">Standard</option>
                                      <option value="wide">Wide</option>
                                      <option value="full">Full width</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Spacing
                                    </label>
                                    <select
                                      value={s.style?.spacing ?? "normal"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          spacing: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["spacing"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="compact">Compact</option>
                                      <option value="normal">Normal</option>
                                      <option value="spacious">Spacious</option>
                                    </select>
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      Button style
                                    </label>
                                    <select
                                      value={s.style?.button_variant ?? "solid"}
                                      onChange={(e) =>
                                        updateSectionStyle(s.id, {
                                          button_variant: e.target.value as NonNullable<
                                            LodgeSiteSection["style"]
                                          >["button_variant"],
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="solid">Solid</option>
                                      <option value="outline">Outline</option>
                                      <option value="ghost">Ghost</option>
                                    </select>
                                  </div>
                                </div>
                                {s.style?.background_image_url && (
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-dash-muted">
                                        Background position
                                      </label>
                                      <select
                                        value={s.style?.background_position ?? "center"}
                                        onChange={(e) =>
                                          updateSectionStyle(s.id, {
                                            background_position: e.target.value,
                                          })
                                        }
                                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                      >
                                        <option value="center">Center</option>
                                        <option value="top">Top</option>
                                        <option value="bottom">Bottom</option>
                                        <option value="top left">Top left</option>
                                        <option value="top right">Top right</option>
                                      </select>
                                    </div>
                                    <div className="space-y-1.5">
                                      <label className="text-xs font-medium text-dash-muted">
                                        Overlay opacity
                                      </label>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={1}
                                        step={0.05}
                                        value={s.style?.overlay_opacity ?? 0.35}
                                        onChange={(e) =>
                                          updateSectionStyle(s.id, {
                                            overlay_opacity: Number(e.target.value),
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                )}
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      CTA label
                                    </label>
                                    <Input
                                      value={s.cta_label ?? ""}
                                      onChange={(e) =>
                                        updateSection(s.id, {
                                          cta_label: e.target.value || null,
                                        })
                                      }
                                      placeholder="e.g. Express interest"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-dash-muted">
                                      CTA destination
                                    </label>
                                    <select
                                      value={s.cta_href ?? ""}
                                      onChange={(e) =>
                                        updateSection(s.id, {
                                          cta_href: e.target.value || null,
                                        })
                                      }
                                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                    >
                                      <option value="">None</option>
                                      <option value="/join">Join page</option>
                                      <option value="/events">Events page</option>
                                      <option value="/charity">Charity page</option>
                                      <option value="/contact">Contact page</option>
                                      <option value="/news">News page</option>
                                      <option value="#lead-intake">
                                        Lead intake form on this page
                                      </option>
                                      <option value="#contact-form">
                                        Contact form on this page
                                      </option>
                                      <option value="custom">Custom URL…</option>
                                    </select>
                                    {s.cta_href === "custom" && (
                                      <Input
                                        placeholder="https://"
                                        onChange={(e) =>
                                          updateSection(s.id, {
                                            cta_href: e.target.value || null,
                                          })
                                        }
                                      />
                                    )}
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-dash-muted">
                                    Form on this section
                                  </label>
                                  <select
                                    value={s.style?.form_mode ?? "none"}
                                    onChange={(e) =>
                                      updateSectionStyle(s.id, {
                                        form_mode: e.target.value as NonNullable<
                                          LodgeSiteSection["style"]
                                        >["form_mode"],
                                      })
                                    }
                                    className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                                  >
                                    <option value="none">No embedded form</option>
                                    <option value="contact">
                                      Contact form to lodge secretary
                                    </option>
                                    <option value="lead">
                                      Lead intake form and CRM lead
                                    </option>
                                  </select>
                                  <p className="text-xs text-dash-muted">
                                    Contact submissions email the lodge secretary. Lead intake also creates a CRM lead.
                                  </p>
                                </div>
                                {s.type === "faq" ? (
                                  <div className="rounded-2xl border border-dash-border bg-dash-surface/60 p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-muted">
                                          FAQ entries
                                        </p>
                                        <p className="mt-1 text-xs text-dash-muted">
                                          Each entry becomes a row in the
                                          accordion on the public site. Leave
                                          empty to hide the accordion (the
                                          heading and image above still show).
                                        </p>
                                      </div>
                                      <Button
                                        type="button"
                                        variant="dashboard"
                                        size="sm"
                                        onClick={() =>
                                          updateFaqEntries(s.id, (entries) => [
                                            ...entries,
                                            { question: "", answer: "" },
                                          ])
                                        }
                                      >
                                        Add FAQ
                                      </Button>
                                    </div>
                                    {(s.style?.faq_entries ?? []).length === 0 ? (
                                      <p className="mt-4 rounded-lg border border-dashed border-dash-border bg-dash-surface px-3 py-3 text-xs text-dash-muted">
                                        No FAQs yet. Add the questions visitors
                                        ask most: dress code, parking, whether
                                        partners are welcome at the dining
                                        table, and how to enquire about
                                        membership.
                                      </p>
                                    ) : (
                                      <ul className="mt-4 space-y-3">
                                        {(s.style?.faq_entries ?? []).map(
                                          (entry, idx) => (
                                            <li
                                              key={idx}
                                              className="rounded-xl border border-dash-border bg-dash-surface p-3"
                                            >
                                              <div className="flex items-start justify-between gap-2">
                                                <label className="text-xs font-medium text-dash-muted">
                                                  Question {idx + 1}
                                                </label>
                                                <button
                                                  type="button"
                                                  className="text-xs text-red-600 hover:underline"
                                                  onClick={() =>
                                                    updateFaqEntries(s.id, (entries) =>
                                                      entries.filter((_, i) => i !== idx)
                                                    )
                                                  }
                                                >
                                                  Remove
                                                </button>
                                              </div>
                                              <Input
                                                value={entry.question}
                                                placeholder="What should visitors wear?"
                                                onChange={(e) =>
                                                  updateFaqEntries(s.id, (entries) =>
                                                    entries.map((item, i) =>
                                                      i === idx
                                                        ? { ...item, question: e.target.value }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="mt-1"
                                              />
                                              <Textarea
                                                value={entry.answer}
                                                placeholder="Lounge suit and a sober tie. White gloves are provided."
                                                onChange={(e) =>
                                                  updateFaqEntries(s.id, (entries) =>
                                                    entries.map((item, i) =>
                                                      i === idx
                                                        ? { ...item, answer: e.target.value }
                                                        : item
                                                    )
                                                  )
                                                }
                                                className="mt-3 min-h-[88px]"
                                              />
                                            </li>
                                          )
                                        )}
                                      </ul>
                                    )}
                                  </div>
                                ) : null}
                                {s.style?.form_mode && s.style.form_mode !== "none" ? (
                                  <div className="rounded-2xl border border-dash-border bg-dash-surface/60 p-4">
                                    <div className="grid gap-4 lg:grid-cols-2">
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-muted">
                                          Visible fields
                                        </p>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                          {FORM_FIELD_OPTIONS.filter((field) =>
                                            s.style?.form_mode === "contact"
                                              ? !["location", "how_heard"].includes(field.id)
                                              : field.id !== "subject"
                                          ).map((field) => {
                                            const selected =
                                              s.style?.form_fields?.includes(field.id) ??
                                              ["phone", "subject", "location", "how_heard", "message"].includes(field.id);
                                            return (
                                              <label
                                                key={field.id}
                                                className="flex items-center gap-2 text-sm text-dash-text"
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={selected}
                                                  onChange={(e) =>
                                                    toggleStyleArrayValue(
                                                      s.id,
                                                      "form_fields",
                                                      field.id,
                                                      e.target.checked
                                                    )
                                                  }
                                                />
                                                {field.label}
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-muted">
                                          Required fields
                                        </p>
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                          {FORM_FIELD_OPTIONS.filter((field) =>
                                            (s.style?.form_fields ?? [
                                              "phone",
                                              "subject",
                                              "location",
                                              "how_heard",
                                              "message",
                                            ]).includes(field.id)
                                          ).map((field) => (
                                            <label
                                              key={field.id}
                                              className="flex items-center gap-2 text-sm text-dash-text"
                                            >
                                              <input
                                                type="checkbox"
                                                checked={
                                                  s.style?.form_required_fields?.includes(field.id) ??
                                                  false
                                                }
                                                onChange={(e) =>
                                                  toggleStyleArrayValue(
                                                    s.id,
                                                    "form_required_fields",
                                                    field.id,
                                                    e.target.checked
                                                  )
                                                }
                                              />
                                              {field.label}
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-dash-muted">
                                          Consent text
                                        </label>
                                        <Input
                                          value={s.style?.form_consent_text ?? ""}
                                          onChange={(e) =>
                                            updateSectionStyle(s.id, {
                                              form_consent_text: e.target.value || null,
                                            })
                                          }
                                          placeholder="I agree to be contacted about my enquiry."
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-dash-muted">
                                          Thank-you message
                                        </label>
                                        <Input
                                          value={s.style?.form_thank_you ?? ""}
                                          onChange={(e) =>
                                            updateSectionStyle(s.id, {
                                              form_thank_you: e.target.value || null,
                                            })
                                          }
                                          placeholder="Thanks. The lodge secretary will be in touch."
                                        />
                                      </div>
                                    </div>
                                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-dash-muted">
                                          Notification recipients
                                        </label>
                                        <Input
                                          value={s.style?.form_notification_recipients ?? ""}
                                          onChange={(e) =>
                                            updateSectionStyle(s.id, {
                                              form_notification_recipients: e.target.value || null,
                                            })
                                          }
                                          placeholder="secretary@example.com, assistant@example.com"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-dash-muted">
                                          Auto-reply subject
                                        </label>
                                        <Input
                                          value={s.style?.form_autoresponder_subject ?? ""}
                                          onChange={(e) =>
                                            updateSectionStyle(s.id, {
                                              form_autoresponder_subject: e.target.value || null,
                                            })
                                          }
                                          placeholder="We received your enquiry"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-dash-muted">
                                          Auto-reply body
                                        </label>
                                        <Input
                                          value={s.style?.form_autoresponder_body ?? ""}
                                          onChange={(e) =>
                                            updateSectionStyle(s.id, {
                                              form_autoresponder_body: e.target.value || null,
                                            })
                                          }
                                          placeholder="Thanks for getting in touch."
                                        />
                                      </div>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                updateSection(s.id, { visible: !s.visible })
                              }
                              title={s.visible ? "Hide" : "Show"}
                            >
                              {s.visible ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                setEditingId(editingId === s.id ? null : s.id)
                              }
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSection(s.id)}
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>

              <div className="flex justify-between border-t border-dash-border bg-dash-surface-subtle p-4">
                <Button
                  variant="dashboard"
                  size="sm"
                  onClick={() => setStep("template")}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Templates
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setStep("preview")}
                >
                  Preview <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {step === "preview" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h3 className="dash-panel-header-title">Live preview</h3>
              <p className="dash-panel-header-description">
                Draft preview with site header, footer, images, and visible sections in order.
              </p>
            </div>
          </div>
          <div className="h-[700px] bg-slate-950">
            <SitePreview
              sections={orderedSections}
              pageTitle={pageTitle}
              pageDescription={pageDescription || null}
              primaryColor={primaryColor}
            />
          </div>
          <div className="flex justify-between border-t border-dash-border bg-dash-surface-subtle p-4">
            <Button variant="dashboard" size="sm" onClick={() => setStep("edit")}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back to edit
            </Button>
            <div className="flex gap-2">
              <Button asChild variant="dashboard" size="sm">
                <a href={publicHref} target="_blank" rel="noreferrer">
                  Preview in new tab
                  <ExternalLink className="ml-2 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="primary" size="sm" onClick={() => setStep("publish")}>
              Continue to publish <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {step === "publish" && (
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h3 className="dash-panel-header-title">Publish</h3>
              <p className="dash-panel-header-description">
                Save changes and decide whether to share publicly.
              </p>
            </div>
          </div>
          <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-6">
            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-5">
              <p className="text-sm font-semibold text-dash-text">
                Current status:{" "}
                <span className={published ? "text-emerald-700" : "text-amber-700"}>
                  {published ? "Published" : "Draft only"}
                </span>
              </p>
              <p className="mt-1 text-sm text-dash-muted">
                Drafts are visible to admins only. Publishing makes the homepage live at{" "}
                <a className="text-dash-ring" href={publicHref} target="_blank" rel="noreferrer">
                  {publicHref}
                </a>
                .
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="primary"
                onClick={() => togglePublish(true)}
                disabled={publishing || saving}
                className="gap-2"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {published ? "Save and keep published" : "Publish now"}
              </Button>
              {published && (
                <Button
                  variant="dashboard"
                  onClick={() => togglePublish(false)}
                  disabled={publishing || saving}
                  className="gap-2"
                >
                  <EyeOff className="h-4 w-4" />
                  Unpublish (return to draft)
                </Button>
              )}
              <Button
                variant="dashboard"
                onClick={() => persist()}
                disabled={publishing || saving}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save draft only
              </Button>
            </div>
          </CardContent>
          <div className="flex justify-between border-t border-dash-border bg-dash-surface-subtle p-4">
            <Button variant="dashboard" size="sm" onClick={() => setStep("preview")}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back to preview
            </Button>
            <Button asChild variant="dashboard" size="sm">
              <a href={publicHref} target="_blank" rel="noreferrer" className="gap-2">
                Open public site <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </Card>
      )}

      {status && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg",
            status.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          )}
        >
          {status.msg}
          <button
            type="button"
            className="ml-1 rounded-md p-0.5 hover:bg-white/40"
            onClick={() => setStatus(null)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
