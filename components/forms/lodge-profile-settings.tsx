"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Save,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ImageUploadField } from "@/components/site-builder/image-upload-field";

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
  lodge_number: string | null;
  consecrated_at: string | null;
  governing_body: string | null;
  meeting_schedule: string | null;
  secretary_name: string | null;
  secretary_address: string | null;
  secretary_phone: string | null;
  data_protection_notice: string | null;
  visiting_notice: string | null;
  loi_contact: string | null;
  meeting_location: string | null;
  meeting_location_url: string | null;
  accessibility_notes: string | null;
  default_dress_code: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  is_active: boolean;
  // Gift Aid / Relief Chest (migration 059). Drives both the per-meeting
  // close workflow and the claim pack export. Treasurer-editable here so
  // we don't need to SQL-poke the lodges table for each new lodge.
  gift_aid_default_mode?: "digital" | "paper" | "both" | null;
  relief_chest_name?: string | null;
  relief_chest_email?: string | null;
  relief_chest_charity_number?: string | null;
  hmrc_charity_reference?: string | null;
};

type AdminLodgeContext = {
  selectedSlug: string;
  lodges: Lodge[];
};


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function LodgeProfileSettings() {
  const [lodges, setLodges] = useState<Lodge[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [lodgeForm, setLodgeForm] = useState<Partial<Lodge>>({});
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [savingLodge, setSavingLodge] = useState(false);

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

  const syncAdminLodgeContext = useCallback(async (lodgeSlug: string) => {
    await fetch("/api/admin/lodge-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lodge_slug: lodgeSlug }),
    });
  }, []);

  useEffect(() => {
    async function loadLodges() {
      setLoading(true);
      flash("");
      try {
        const res = await fetch("/api/admin/lodge-context");
        if (!res.ok) throw new Error("Failed to load lodges");
        const data = (await res.json()) as AdminLodgeContext;
        const requestedSlug = new URLSearchParams(window.location.search).get("lodge");
        const requestedLodge = requestedSlug
          ? data.lodges.find((lodge) => lodge.slug === requestedSlug)
          : null;
        const selected = requestedLodge?.slug ?? data.selectedSlug;
        setLodges(data.lodges);
        if (selected) {
          const lodge =
            data.lodges.find((item) => item.slug === selected) ?? data.lodges[0];
          setSelectedSlug(lodge.slug);
          setLodgeForm(lodge);
          if (requestedLodge && requestedLodge.slug !== data.selectedSlug) {
            await syncAdminLodgeContext(requestedLodge.slug);
          }
        }
      } catch {
        flash("Could not load lodges.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadLodges();
  }, [flash, syncAdminLodgeContext]);

  useEffect(() => {
    if (!selectedSlug) return;
    const lodge = lodges.find((item) => item.slug === selectedSlug);
    if (lodge) setLodgeForm(lodge);
  }, [selectedSlug, lodges]);

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
        lodge_number: lodgeForm.lodge_number?.trim() || null,
        consecrated_at: lodgeForm.consecrated_at?.trim() || null,
        governing_body: lodgeForm.governing_body?.trim() || null,
        meeting_schedule: lodgeForm.meeting_schedule?.trim() || null,
        secretary_name: lodgeForm.secretary_name?.trim() || null,
        secretary_address: lodgeForm.secretary_address?.trim() || null,
        secretary_phone: lodgeForm.secretary_phone?.trim() || null,
        data_protection_notice: lodgeForm.data_protection_notice?.trim() || null,
        visiting_notice: lodgeForm.visiting_notice?.trim() || null,
        loi_contact: lodgeForm.loi_contact?.trim() || null,
        meeting_location: lodgeForm.meeting_location?.trim() || null,
        meeting_location_url: lodgeForm.meeting_location_url?.trim() || null,
        accessibility_notes: lodgeForm.accessibility_notes?.trim() || null,
        default_dress_code: lodgeForm.default_dress_code?.trim() || null,
        primary_color: lodgeForm.primary_color?.trim() || null,
        secondary_color: lodgeForm.secondary_color?.trim() || null,
        is_active: lodgeForm.is_active !== false,
        gift_aid_default_mode: lodgeForm.gift_aid_default_mode ?? "both",
        relief_chest_name: lodgeForm.relief_chest_name?.trim() || null,
        relief_chest_email: lodgeForm.relief_chest_email?.trim() || null,
        relief_chest_charity_number:
          lodgeForm.relief_chest_charity_number?.trim() || null,
        hmrc_charity_reference:
          lodgeForm.hmrc_charity_reference?.trim() || null,
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
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-dash-text">Lodge Profile</h2>
        <p className="mt-1 text-sm text-dash-muted">
          Manage lodge identity, contact details, and formal summons information.
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
                onValueChange={async (value) => {
                  setSelectedSlug(value);
                  flash("");
                  await syncAdminLodgeContext(value);
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

            <ImageUploadField
              label="Lodge logo"
              value={lodgeForm.logo_url ?? ""}
              onChange={(value) =>
                setLodgeForm((prev) => ({ ...prev, logo_url: value }))
              }
              onClear={() => setLodgeForm((prev) => ({ ...prev, logo_url: "" }))}
              help="Used on the public website, digital member card, formal summons, and other lodge-branded pages. You can also manage this under Website → Brand."
            />

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Formal lodge and summons details
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                These details are used on summons previews, member summons pages,
                and formal lodge communications.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Lodge number"
                  value={lodgeForm.lodge_number ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, lodge_number: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Governing body"
                  value={lodgeForm.governing_body ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, governing_body: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Consecrated date"
                  type="date"
                  value={lodgeForm.consecrated_at?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, consecrated_at: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary name"
                  value={lodgeForm.secretary_name ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, secretary_name: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary phone"
                  value={lodgeForm.secretary_phone ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, secretary_phone: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Lodge of Instruction contact"
                  value={lodgeForm.loi_contact ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, loi_contact: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Meeting schedule"
                  value={lodgeForm.meeting_schedule ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, meeting_schedule: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Secretary address"
                  value={lodgeForm.secretary_address ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, secretary_address: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Visiting notice"
                  value={lodgeForm.visiting_notice ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, visiting_notice: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Data protection notice"
                  value={lodgeForm.data_protection_notice ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, data_protection_notice: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
              </div>
            </div>

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Public website details
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                Used on the public Meeting Details section. Distinct from the
                secretary&apos;s correspondence address above so visitors see
                the venue, not the postal address.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Textarea
                  placeholder="Meeting venue (e.g. Mark Masons Hall, 86 St James's Street, London)"
                  value={lodgeForm.meeting_location ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, meeting_location: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Meeting venue map link (e.g. https://maps.app.goo.gl/…)"
                  value={lodgeForm.meeting_location_url ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, meeting_location_url: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Default dress code (e.g. Lounge suit, black tie)"
                  value={lodgeForm.default_dress_code ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, default_dress_code: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Accessibility notes (step-free access, hearing loop, parking…)"
                  value={lodgeForm.accessibility_notes ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({ ...prev, accessibility_notes: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
              </div>
            </div>

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Gift Aid &amp; Relief Chest
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                Tells LodgePay how to collect Gift Aid declarations and where
                to forward the claim pack after each meeting close. Required
                fields for the HMRC reclaim end up in MANIFEST.txt of every
                downloaded pack.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.16em] text-dash-faint">
                    Default declaration capture
                  </label>
                  <Select
                    value={lodgeForm.gift_aid_default_mode ?? "both"}
                    onValueChange={(value) =>
                      setLodgeForm((prev) => ({
                        ...prev,
                        gift_aid_default_mode: value as
                          | "digital"
                          | "paper"
                          | "both",
                      }))
                    }
                  >
                    <SelectTrigger className="border-dash-border bg-dash-surface text-dash-text">
                      <SelectValue placeholder="Both digital and paper" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">
                        Both digital and paper (recommended)
                      </SelectItem>
                      <SelectItem value="digital">
                        Digital only (in-portal signature)
                      </SelectItem>
                      <SelectItem value="paper">
                        Paper only (scan signed slip)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] leading-snug text-dash-muted">
                    Paper-friendly lodges (Lester&apos;s rule) should pick
                    &quot;Both&quot; or &quot;Paper only&quot; so the on-the-day
                    capture flow stays in front of treasurers.
                  </p>
                </div>
                <Input
                  placeholder="Relief Chest name (e.g. Provincial Grand Charity)"
                  value={lodgeForm.relief_chest_name ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({
                      ...prev,
                      relief_chest_name: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Relief Chest email (where you forward the pack)"
                  type="email"
                  value={lodgeForm.relief_chest_email ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({
                      ...prev,
                      relief_chest_email: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Relief Chest charity number"
                  value={lodgeForm.relief_chest_charity_number ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({
                      ...prev,
                      relief_chest_charity_number: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="HMRC charity reference (e.g. XR12345)"
                  value={lodgeForm.hmrc_charity_reference ?? ""}
                  onChange={(e) =>
                    setLodgeForm((prev) => ({
                      ...prev,
                      hmrc_charity_reference: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
              </div>
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
              <span className="text-xs text-dash-muted">
                Slug: {selectedSlug || "Not selected"}
              </span>
            </div>
          </div>
        )}
      </div>

      {status && (
        <div
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
          {status}
          <button
            type="button"
            onClick={() => flash("")}
            className="ml-1 rounded-md p-0.5 transition-colors hover:bg-dash-surface-subtle"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
