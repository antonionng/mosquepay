"use client";

import { Puck, type Data } from "@measured/puck";
import "@measured/puck/puck.css";
import "./puck-overrides.css";
import { puckConfig } from "./puck-config";
import { useState, useCallback } from "react";
import {
  Sparkles,
  Save,
  Loader2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ChurchSiteSection } from "@/lib/db/types";
import { mergeHeroPrimaryColor, sanitizeSectionStyle } from "@/lib/site-section-style";

type SiteSection = ChurchSiteSection;

type ChurchSite = {
  page_title: string;
  page_description: string | null;
  sections: SiteSection[];
};

const tonePresets = [
  "welcoming",
  "formal",
  "traditional",
  "modern",
  "community",
] as const;

const SECTION_TO_COMPONENT: Record<string, string> = {
  hero: "Hero",
  about: "About",
  service_details: "ServiceDetails",
  officers: "Officers",
  charity: "Charity",
  events: "Events",
  faq: "FAQ",
  join: "JoinUs",
  contact: "Contact",
};

const COMPONENT_TO_SECTION: Record<string, SiteSection["type"]> = {
  Hero: "hero",
  About: "about",
  ServiceDetails: "service_details",
  Officers: "officers",
  Charity: "charity",
  Events: "events",
  FAQ: "faq",
  JoinUs: "join",
  Contact: "contact",
};

function sectionsToPuckData(sections: SiteSection[], primaryColor?: string): Data {
  return {
    root: { props: {} },
    content: sections
      .filter((s) => s.visible)
      .sort((a, b) => a.order - b.order)
      .map((section) => {
        const componentType = SECTION_TO_COMPONENT[section.type] ?? "About";
        const baseProps: Record<string, unknown> = {
          id: section.id,
          heading: section.heading,
          body: section.body ?? "",
          ctaLabel: section.cta_label ?? "",
          ctaHref: section.cta_href ?? "",
          imageUrl: section.style?.image_url ?? "",
          imageAlt: section.style?.image_alt ?? "",
          imagePosition: section.style?.image_position ?? "right",
          imageShape: section.style?.image_shape ?? "rounded",
          backgroundImageUrl: section.style?.background_image_url ?? "",
          overlayOpacity:
            typeof section.style?.overlay_opacity === "number"
              ? section.style.overlay_opacity
              : 0.35,
          backgroundPosition: section.style?.background_position ?? "center",
          formMode: section.style?.form_mode ?? "none",
          backgroundTone: section.style?.background_tone ?? "default",
          contentWidth: section.style?.content_width ?? "standard",
          spacing: section.style?.spacing ?? "normal",
          buttonVariant: section.style?.button_variant ?? "solid",
          formFields: section.style?.form_fields?.join(",") ?? "",
          formRequiredFields: section.style?.form_required_fields?.join(",") ?? "",
          formConsentText: section.style?.form_consent_text ?? "",
          formThankYou: section.style?.form_thank_you ?? "",
          formNotificationRecipients: section.style?.form_notification_recipients ?? "",
          formAutoresponderSubject: section.style?.form_autoresponder_subject ?? "",
          formAutoresponderBody: section.style?.form_autoresponder_body ?? "",
        };
        if (section.type === "hero") {
          baseProps.primaryColor = mergeHeroPrimaryColor(section, primaryColor);
          baseProps.backgroundImageUrl = section.style?.background_image_url ?? "";
          baseProps.overlayOpacity =
            typeof section.style?.overlay_opacity === "number"
              ? section.style.overlay_opacity
              : 0.45;
          baseProps.backgroundPosition = section.style?.background_position ?? "center";
        }
        return { type: componentType, props: baseProps };
      }),
    zones: {},
  };
}

export function puckDataToSections(data: Data): SiteSection[] {
  return data.content.map((item, index) => {
    const props = item.props as Record<string, unknown>;
    const type = COMPONENT_TO_SECTION[item.type] ?? "about";
    const base: SiteSection = {
      id: (props.id as string) ?? crypto.randomUUID(),
      type,
      heading: (props.heading as string) ?? "",
      body: (props.body as string) || null,
      cta_label: (props.ctaLabel as string) || null,
      cta_href: (props.ctaHref as string) || null,
      visible: true,
      order: index + 1,
    };
    const style = sanitizeSectionStyle({
      primary_color: type === "hero" ? props.primaryColor : undefined,
      background_image_url: props.backgroundImageUrl,
      overlay_opacity: props.overlayOpacity,
      background_position: props.backgroundPosition,
      image_url: props.imageUrl,
      image_alt: props.imageAlt,
      image_position: props.imagePosition,
      image_shape: props.imageShape,
      form_mode: props.formMode,
      background_tone: props.backgroundTone,
      content_width: props.contentWidth,
      spacing: props.spacing,
      button_variant: props.buttonVariant,
      form_fields: props.formFields,
      form_required_fields: props.formRequiredFields,
      form_consent_text: props.formConsentText,
      form_thank_you: props.formThankYou,
      form_notification_recipients: props.formNotificationRecipients,
      form_autoresponder_subject: props.formAutoresponderSubject,
      form_autoresponder_body: props.formAutoresponderBody,
    });
    if (style) return { ...base, style };
    return base;
  });
}

export function PuckEditor({
  churchSlug,
  initialSections,
  pageTitle: initialPageTitle,
  pageDescription: initialPageDescription,
  primaryColor = "#3b82f6",
}: {
  churchSlug: string;
  initialSections: SiteSection[];
  pageTitle: string;
  pageDescription: string | null;
  primaryColor?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const [pageTitle, setPageTitle] = useState(initialPageTitle);
  const [pageDescription, setPageDescription] = useState(initialPageDescription ?? "");

  const [aiBrief, setAiBrief] = useState("");
  const [aiTone, setAiTone] = useState("welcoming");
  const [aiAudience, setAiAudience] = useState("prospective members");
  const [aiFocus, setAiFocus] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);

  const [puckData, setPuckData] = useState<Data>(() =>
    sectionsToPuckData(initialSections, primaryColor)
  );

  const flash = useCallback(
    (msg: string, type: "success" | "error") => {
      setStatus({ msg, type });
      setTimeout(() => setStatus(null), 4000);
    },
    []
  );

  const handleSave = useCallback(
    async (data: Data) => {
      setSaving(true);
      try {
        const sections = puckDataToSections(data);
        const res = await fetch(`/api/churches/${churchSlug}/site`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page_title: pageTitle,
            page_description: pageDescription || null,
            sections,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        flash("Website content saved.", "success");
      } catch {
        flash("Could not save website content.", "error");
      } finally {
        setSaving(false);
      }
    },
    [churchSlug, pageTitle, pageDescription, flash]
  );

  const handleAiGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/churches/${churchSlug}/ai-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: aiBrief,
          tone: aiTone,
          audience: aiAudience,
          focus: aiFocus,
          existing_sections: puckDataToSections(puckData),
        }),
      });
      if (!res.ok) throw new Error("Draft generation failed");
      const json = await res.json();
      const draft = json.draft as ChurchSite;
      setPageTitle(draft.page_title);
      setPageDescription(draft.page_description ?? "");
      setPuckData(sectionsToPuckData(draft.sections, primaryColor));
      flash(
        json.source === "fallback"
          ? "Draft generated from templates. Review and save."
          : "AI draft generated. Review and save when ready.",
        "success"
      );
    } catch {
      flash("Could not generate AI draft.", "error");
    } finally {
      setGenerating(false);
    }
  }, [churchSlug, aiBrief, aiTone, aiAudience, aiFocus, primaryColor, puckData, flash]);

  return (
    <div className="flex flex-col">
      {/* AI Studio Panel */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Page Title</label>
              <Input
                value={pageTitle}
                onChange={(e) => setPageTitle(e.target.value)}
                placeholder="Page title"
                className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-400">Page Description</label>
              <Input
                value={pageDescription}
                onChange={(e) => setPageDescription(e.target.value)}
                placeholder="Meta description for SEO"
                className="h-8 border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAiPanel((v) => !v)}
            className={cn(
              "gap-2",
              showAiPanel
                ? "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
                : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
            )}
          >
            <Wand2 className="h-4 w-4" />
            AI Studio
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleSave(puckData)}
            disabled={saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {showAiPanel && (
        <div className="border-b border-white/[0.06] bg-gradient-to-b from-blue-500/[0.04] to-transparent p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
                <Wand2 className="h-3.5 w-3.5 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-white">AI Draft Controls</span>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAiGenerate}
              disabled={generating}
              className="gap-2"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {generating ? "Generating…" : "Generate Full Draft"}
            </Button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {tonePresets.map((preset) => (
              <button
                key={preset}
                onClick={() => setAiTone(preset)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium capitalize transition-all",
                  aiTone === preset
                    ? "bg-blue-500 text-white shadow-sm"
                    : "border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.14] hover:text-white"
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              placeholder="Tone (e.g. welcoming, premium)"
              value={aiTone}
              onChange={(e) => setAiTone(e.target.value)}
              className="border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
            />
            <Input
              placeholder="Audience (e.g. prospective members)"
              value={aiAudience}
              onChange={(e) => setAiAudience(e.target.value)}
              className="border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Textarea
              placeholder="Short church brief. Describe your church…"
              rows={3}
              value={aiBrief}
              onChange={(e) => setAiBrief(e.target.value)}
              className="min-h-[80px] border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
            />
            <Textarea
              placeholder="Focus areas (events, charity, growth…)"
              rows={3}
              value={aiFocus}
              onChange={(e) => setAiFocus(e.target.value)}
              className="min-h-[80px] border-white/10 bg-white/[0.04] text-sm text-white placeholder:text-slate-600"
            />
          </div>
          <p className="mt-3 text-[11px] text-slate-500">
            Content guardrails are applied automatically to keep copy clear, compliant, and safe.
          </p>
        </div>
      )}

      {/* Puck Editor */}
      <div className="min-h-[700px]">
        <Puck
          config={puckConfig}
          data={puckData}
          onChange={setPuckData}
          onPublish={handleSave}
        />
      </div>

      {/* Status toast */}
      {status && (
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
            status.type === "success" &&
              "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
            status.type === "error" &&
              "border-red-500/20 bg-red-500/10 text-red-300"
          )}
        >
          {status.msg}
        </div>
      )}
    </div>
  );
}
