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
  Loader2,
  Pencil,
  Plus,
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
import { TEMPLATES, SECTION_PRESETS } from "@/lib/site-builder/templates";

type Step = "template" | "edit" | "preview" | "publish";

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
  { id: "template", label: "Choose template" },
  { id: "edit", label: "Edit sections" },
  { id: "preview", label: "Preview" },
  { id: "publish", label: "Publish" },
];

export function SimpleSiteBuilder({
  lodgeSlug,
  initialSections,
  pageTitle: initialPageTitle,
  pageDescription: initialPageDescription,
  primaryColor = "#3b82f6",
  initiallyPublished,
  publicHref,
}: {
  lodgeSlug: string;
  initialSections: LodgeSiteSection[];
  pageTitle: string;
  pageDescription: string | null;
  primaryColor?: string;
  initiallyPublished: boolean;
  publicHref: string;
}) {
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

  function applyTemplate(templateId: string) {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setSections(tpl.buildSections());
    setStep("edit");
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

  function addSection(type: LodgeSiteSection["type"]) {
    const preset = SECTION_PRESETS.find((p) => p.type === type);
    if (!preset) return;
    const next = preset.example();
    setSections((prev) => [...prev, { ...next, order: prev.length + 1 }]);
    setShowAddPanel(false);
    setEditingId(next.id);
  }

  async function persist(opts: { nextPublished?: boolean } = {}) {
    setSaving(true);
    try {
      const res = await fetch(`/api/lodges/${lodgeSlug}/site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_title: pageTitle,
          page_description: pageDescription || null,
          sections: orderedSections,
          ...(opts.nextPublished !== undefined
            ? { published: opts.nextPublished }
            : {}),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      flash("Saved.", "success");
      if (opts.nextPublished !== undefined) setPublished(opts.nextPublished);
    } catch {
      flash("Could not save changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(nextPublished: boolean) {
    setPublishing(true);
    await persist({ nextPublished });
    setPublishing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-dash-text">
            <Sparkles className="h-5 w-5 text-amber-600" />
            Lodge website builder
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            Pick a template, edit sections in friendly forms, preview, and publish when ready.
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
              View site <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>

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
            {advanced ? "Hide advanced editor" : "Advanced editor"}
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
                Pick the layout closest to your lodge. You can rearrange and edit anything afterwards.
              </p>
            </div>
          </div>
          <CardContent className="grid gap-4 border-t border-dash-border bg-dash-surface p-5 md:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className="group flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-5 text-left transition-colors hover:border-dash-ring/50 hover:bg-dash-surface"
              >
                <p className="text-sm font-semibold text-dash-text group-hover:text-dash-ring">
                  {t.name}
                </p>
                <p className="text-sm text-dash-muted">{t.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {t.buildSections().map((s) => (
                    <span
                      key={s.id}
                      className="rounded-full border border-dash-border bg-white px-2 py-0.5 text-[11px] text-dash-muted"
                    >
                      {SECTION_LABELS[s.type]}
                    </span>
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-dash-ring">
                  Use this template <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
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
                  <h3 className="dash-panel-header-title">Sections</h3>
                  <p className="dash-panel-header-description">
                    Reorder, hide, or edit individual sections.
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
                <div className="grid gap-2 border-t border-dash-border bg-dash-surface-subtle p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {SECTION_PRESETS.map((p) => (
                    <button
                      key={p.type}
                      type="button"
                      onClick={() => addSection(p.type)}
                      className="flex flex-col items-start gap-1 rounded-lg border border-dash-border bg-white p-3 text-left text-sm hover:border-dash-ring/50 hover:bg-dash-surface"
                    >
                      <span className="font-medium text-dash-text">{p.label}</span>
                      <span className="text-xs text-dash-muted">{p.description}</span>
                    </button>
                  ))}
                </div>
              )}

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
                Showing only visible sections, in order.
              </p>
            </div>
          </div>
          <div className="h-[700px] bg-slate-950">
            <SitePreview
              sections={orderedSections}
              pageTitle={pageTitle}
              primaryColor={primaryColor}
            />
          </div>
          <div className="flex justify-between border-t border-dash-border bg-dash-surface-subtle p-4">
            <Button variant="dashboard" size="sm" onClick={() => setStep("edit")}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Back to edit
            </Button>
            <Button variant="primary" size="sm" onClick={() => setStep("publish")}>
              Continue to publish <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
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
