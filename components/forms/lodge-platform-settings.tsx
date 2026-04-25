"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Save,
  Check,
  X,
  Palette,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PuckEditor } from "@/components/site-builder/puck-editor";
import type { LodgeSiteSection } from "@/lib/db/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Lodge = {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  is_active: boolean;
};

type SiteSection = LodgeSiteSection;

type LodgeSite = {
  page_title: string;
  page_description: string | null;
  sections: SiteSection[];
};


// ---------------------------------------------------------------------------
// Color Swatch Input
// ---------------------------------------------------------------------------

function ColorInput({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-dash-muted">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className="h-9 w-9 rounded-lg border border-dash-border shadow-inner"
            style={{ backgroundColor: value || "#3b82f6" }}
          />
          <input
            type="color"
            value={value || "#3b82f6"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#3b82f6"
          className="h-9 border-dash-border bg-dash-surface text-sm text-dash-text placeholder:text-dash-faint focus-visible:border-blue-500/50 focus-visible:ring-blue-500/20"
        />
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LodgePlatformSettings() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [lodgeForm, setLodgeForm] = useState<Partial<Lodge>>({});
  const [site, setSite] = useState<LodgeSite | null>(null);
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [savingLodge, setSavingLodge] = useState(false);
  const [showTheme, setShowTheme] = useState(false);

  const selectedLodge = useMemo(
    () => lodges.find((lodge) => lodge.slug === selectedSlug) ?? null,
    [lodges, selectedSlug]
  );

  const flash = useCallback(
    (msg: string, type: "info" | "error" | "success" = "info") => {
      setStatus(msg);
      setStatusType(type);
    },
    []
  );

  useEffect(() => {
    async function loadLodges() {
      setLoading(true);
      flash("");
      try {
        const res = await fetch("/api/lodges");
        if (!res.ok) throw new Error("Failed to load lodges");
        const data = (await res.json()) as Lodge[];
        setLodges(data);
        if (data[0]) {
          setSelectedSlug(data[0].slug);
          setLodgeForm(data[0]);
        }
      } catch {
        flash("Could not load lodges.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadLodges();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedSlug) return;
    const lodge = lodges.find((item) => item.slug === selectedSlug);
    if (lodge) setLodgeForm(lodge);

    async function loadSite() {
      flash("");
      try {
        const res = await fetch(`/api/lodges/${selectedSlug}/site`);
        if (!res.ok) throw new Error("Failed to load lodge site");
        const data = await res.json();
        setSite(data.site as LodgeSite);
      } catch {
        flash("Could not load lodge website settings.", "error");
      }
    }
    loadSite();
  }, [selectedSlug, lodges]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveLodge() {
    if (!selectedSlug || !lodgeForm.name?.trim()) {
      flash("Lodge name is required.", "error");
      return;
    }
    setSavingLodge(true);
    flash("");
    try {
      const payload = {
        slug: selectedSlug,
        name: lodgeForm.name.trim(),
        city: lodgeForm.city?.trim() || null,
        country: lodgeForm.country?.trim() || null,
        tagline: lodgeForm.tagline?.trim() || null,
        support_email: lodgeForm.support_email?.trim() || null,
        support_phone: lodgeForm.support_phone?.trim() || null,
        logo_url: lodgeForm.logo_url?.trim() || null,
        primary_color: lodgeForm.primary_color?.trim() || null,
        secondary_color: lodgeForm.secondary_color?.trim() || null,
        is_active: lodgeForm.is_active !== false,
      };
      const res = await fetch("/api/lodges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save lodge");
      const data = await res.json();
      const lodge = data.lodge as Lodge;
      setLodges((prev) =>
        prev.map((item) => (item.slug === lodge.slug ? lodge : item))
      );
      setLodgeForm(lodge);
      flash("Lodge profile saved.", "success");
    } catch {
      flash("Could not save lodge profile.", "error");
    } finally {
      setSavingLodge(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Lodge Profile */}
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-dash-text">Lodge Profile</h2>
        <p className="mt-1 text-sm text-dash-muted">
          Manage lodge identity, contact details, and brand settings.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-dash-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading lodges…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-dash-faint">
                Lodge
              </label>
              <Select
                value={selectedSlug}
                onValueChange={(value) => {
                  setSelectedSlug(value);
                  flash("");
                }}
              >
                <SelectTrigger className="border-dash-border bg-dash-surface text-dash-text">
                  <SelectValue placeholder="Select lodge" />
                </SelectTrigger>
                <SelectContent>
                  {lodges.map((lodge) => (
                    <SelectItem key={lodge.slug} value={lodge.slug}>
                      {lodge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Lodge name"
                value={lodgeForm.name ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Tagline"
                value={lodgeForm.tagline ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({
                    ...prev,
                    tagline: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="City"
                value={lodgeForm.city ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Country"
                value={lodgeForm.country ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support email"
                value={lodgeForm.support_email ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({
                    ...prev,
                    support_email: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support phone"
                value={lodgeForm.support_phone ?? ""}
                onChange={(e) =>
                  setLodgeForm((prev) => ({
                    ...prev,
                    support_phone: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
            </div>

            {/* Theme controls */}
            <div>
              <button
                onClick={() => setShowTheme((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-dash-text transition-colors hover:text-dash-ring"
              >
                <Palette className="h-4 w-4 text-blue-600" />
                Brand Colors
                {showTheme ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <AnimatePresence>
                {showTheme && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 grid gap-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 sm:grid-cols-2">
                      <ColorInput
                        label="Primary Color"
                        value={lodgeForm.primary_color ?? ""}
                        onChange={(v) =>
                          setLodgeForm((prev) => ({
                            ...prev,
                            primary_color: v,
                          }))
                        }
                      />
                      <ColorInput
                        label="Secondary Color"
                        value={lodgeForm.secondary_color ?? ""}
                        onChange={(v) =>
                          setLodgeForm((prev) => ({
                            ...prev,
                            secondary_color: v,
                          }))
                        }
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={saveLodge}
                disabled={savingLodge || !selectedLodge}
                className="gap-2"
              >
                {savingLodge ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingLodge ? "Saving…" : "Save Lodge Profile"}
              </Button>
              {selectedSlug && (
                <Button asChild variant="secondary">
                  <Link
                    href={`/?lodge=${selectedSlug}`}
                    target="_blank"
                    className="gap-2"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Preview Lodge Site
                  </Link>
                </Button>
              )}
              <span className="text-xs text-dash-muted">
                Slug: {selectedSlug || "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Lodge One-Pager Builder */}
      <div className="admin-surface overflow-hidden">
        <div className="border-b border-dash-border p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-dash-text">
            <Sparkles className="h-5 w-5 text-amber-600" />
            Lodge One-Pager Builder
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            Visually edit your lodge homepage with drag-and-drop sections.
          </p>
        </div>
        {!site ? (
          <div className="flex items-center justify-center p-12 text-sm text-dash-muted">
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading site data…
              </span>
            ) : (
              "Select a lodge to load page settings."
            )}
          </div>
        ) : (
          <PuckEditor
            lodgeSlug={selectedSlug}
            initialSections={site.sections}
            pageTitle={site.page_title}
            pageDescription={site.page_description}
            primaryColor={lodgeForm.primary_color ?? "#3b82f6"}
          />
        )}
      </div>

      {/* Status toast */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur-sm",
              statusType === "success" &&
                "border-emerald-200 bg-emerald-50 text-emerald-900",
              statusType === "error" &&
                "border-red-200 bg-red-50 text-red-900",
              statusType === "info" &&
                "border-dash-border bg-dash-surface text-dash-text shadow-dash"
            )}
          >
            {statusType === "success" && <Check className="h-4 w-4" />}
            {statusType === "error" && <X className="h-4 w-4" />}
            {status}
            <button
              onClick={() => flash("")}
              className="ml-1 rounded-md p-0.5 transition-colors hover:bg-dash-surface-subtle"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
