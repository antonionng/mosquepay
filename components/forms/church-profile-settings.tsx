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

type Church = {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  logo_url: string | null;
  church_number: string | null;
  consecrated_at: string | null;
  governing_body: string | null;
  service_schedule: string | null;
  secretary_name: string | null;
  secretary_address: string | null;
  secretary_phone: string | null;
  data_protection_notice: string | null;
  newcomer_notice: string | null;
  loi_contact: string | null;
  service_location: string | null;
  service_location_url: string | null;
  accessibility_notes: string | null;
  default_dress_code: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  is_active: boolean;
  // Gift Aid / Gift Aid pack (migration 059). Drives both the per-service
  // close workflow and the claim pack export. Treasurer-editable here so
  // we don't need to SQL-poke the churches table for each new church.
  gift_aid_default_mode?: "digital" | "paper" | "both" | null;
  gift_aid_pack_name?: string | null;
  gift_aid_pack_email?: string | null;
  gift_aid_pack_charity_number?: string | null;
  hmrc_charity_reference?: string | null;
};

type AdminChurchContext = {
  selectedSlug: string;
  churches: Church[];
};


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChurchProfileSettings() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [churchForm, setChurchForm] = useState<Partial<Church>>({});
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [savingChurch, setSavingChurch] = useState(false);

  const selectedChurch = useMemo(
    () => churches.find((church) => church.slug === selectedSlug) ?? null,
    [churches, selectedSlug]
  );

  const flash = useCallback(
    (msg: string, type: "info" | "error" | "success" = "info") => {
      setStatus(msg);
      setStatusType(type);
    },
    []
  );

  const syncAdminChurchContext = useCallback(async (churchSlug: string) => {
    await fetch("/api/admin/church-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ church_slug: churchSlug }),
    });
  }, []);

  useEffect(() => {
    async function loadChurches() {
      setLoading(true);
      flash("");
      try {
        const res = await fetch("/api/admin/church-context");
        if (!res.ok) throw new Error("Failed to load churches");
        const data = (await res.json()) as AdminChurchContext;
        const requestedSlug = new URLSearchParams(window.location.search).get("church");
        const requestedChurch = requestedSlug
          ? data.churches.find((church) => church.slug === requestedSlug)
          : null;
        const selected = requestedChurch?.slug ?? data.selectedSlug;
        setChurches(data.churches);
        if (selected) {
          const church =
            data.churches.find((item) => item.slug === selected) ?? data.churches[0];
          setSelectedSlug(church.slug);
          setChurchForm(church);
          if (requestedChurch && requestedChurch.slug !== data.selectedSlug) {
            await syncAdminChurchContext(requestedChurch.slug);
          }
        }
      } catch {
        flash("Could not load churches.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadChurches();
  }, [flash, syncAdminChurchContext]);

  useEffect(() => {
    if (!selectedSlug) return;
    const church = churches.find((item) => item.slug === selectedSlug);
    if (church) setChurchForm(church);
  }, [selectedSlug, churches]);

  async function saveChurch() {
    if (!selectedSlug || !churchForm.name?.trim()) {
      flash("Church name is required.", "error");
      return;
    }
    setSavingChurch(true);
    flash("");
    try {
      const payload = {
        slug: selectedSlug,
        name: churchForm.name.trim(),
        city: churchForm.city?.trim() || null,
        country: churchForm.country?.trim() || null,
        tagline: churchForm.tagline?.trim() || null,
        support_email: churchForm.support_email?.trim() || null,
        support_phone: churchForm.support_phone?.trim() || null,
        logo_url: churchForm.logo_url?.trim() || null,
        church_number: churchForm.church_number?.trim() || null,
        consecrated_at: churchForm.consecrated_at?.trim() || null,
        governing_body: churchForm.governing_body?.trim() || null,
        service_schedule: churchForm.service_schedule?.trim() || null,
        secretary_name: churchForm.secretary_name?.trim() || null,
        secretary_address: churchForm.secretary_address?.trim() || null,
        secretary_phone: churchForm.secretary_phone?.trim() || null,
        data_protection_notice: churchForm.data_protection_notice?.trim() || null,
        newcomer_notice: churchForm.newcomer_notice?.trim() || null,
        loi_contact: churchForm.loi_contact?.trim() || null,
        service_location: churchForm.service_location?.trim() || null,
        service_location_url: churchForm.service_location_url?.trim() || null,
        accessibility_notes: churchForm.accessibility_notes?.trim() || null,
        default_dress_code: churchForm.default_dress_code?.trim() || null,
        primary_color: churchForm.primary_color?.trim() || null,
        secondary_color: churchForm.secondary_color?.trim() || null,
        is_active: churchForm.is_active !== false,
        gift_aid_default_mode: churchForm.gift_aid_default_mode ?? "both",
        gift_aid_pack_name: churchForm.gift_aid_pack_name?.trim() || null,
        gift_aid_pack_email: churchForm.gift_aid_pack_email?.trim() || null,
        gift_aid_pack_charity_number:
          churchForm.gift_aid_pack_charity_number?.trim() || null,
        hmrc_charity_reference:
          churchForm.hmrc_charity_reference?.trim() || null,
      };
      const res = await fetch("/api/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save church");
      const data = await res.json();
      const church = data.church as Church;
      setChurches((prev) =>
        prev.map((item) => (item.slug === church.slug ? church : item))
      );
      setChurchForm(church);
      flash("Church profile saved.", "success");
    } catch {
      flash("Could not save church profile.", "error");
    } finally {
      setSavingChurch(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-dash-text">Church Profile</h2>
        <p className="mt-1 text-sm text-dash-muted">
          Manage church identity, contact details, and formal notice information.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-dash-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading churches…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-dash-faint">
                Church
              </label>
              <Select
                value={selectedSlug}
                onValueChange={async (value) => {
                  setSelectedSlug(value);
                  flash("");
                  await syncAdminChurchContext(value);
                }}
              >
                <SelectTrigger className="border-dash-border bg-dash-surface text-dash-text">
                  <SelectValue placeholder="Select church" />
                </SelectTrigger>
                <SelectContent>
                  {churches.map((church) => (
                    <SelectItem key={church.slug} value={church.slug}>
                      {church.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Church name"
                value={churchForm.name ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Tagline"
                value={churchForm.tagline ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({
                    ...prev,
                    tagline: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="City"
                value={churchForm.city ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Country"
                value={churchForm.country ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support email"
                value={churchForm.support_email ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({
                    ...prev,
                    support_email: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support phone"
                value={churchForm.support_phone ?? ""}
                onChange={(e) =>
                  setChurchForm((prev) => ({
                    ...prev,
                    support_phone: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
            </div>

            <ImageUploadField
              label="Church logo"
              value={churchForm.logo_url ?? ""}
              onChange={(value) =>
                setChurchForm((prev) => ({ ...prev, logo_url: value }))
              }
              onClear={() => setChurchForm((prev) => ({ ...prev, logo_url: "" }))}
              help="Used on the public website, digital member card, formal notice, and other church-branded pages. You can also manage this under Website → Brand."
            />

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Formal church and notice details
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                These details are used on notice previews, member notice pages,
                and formal church communications.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Church number"
                  value={churchForm.church_number ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, church_number: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Governing body"
                  value={churchForm.governing_body ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, governing_body: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Consecrated date"
                  type="date"
                  value={churchForm.consecrated_at?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, consecrated_at: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary name"
                  value={churchForm.secretary_name ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, secretary_name: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary phone"
                  value={churchForm.secretary_phone ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, secretary_phone: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Church of Instruction contact"
                  value={churchForm.loi_contact ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, loi_contact: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Service schedule"
                  value={churchForm.service_schedule ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, service_schedule: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Secretary address"
                  value={churchForm.secretary_address ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, secretary_address: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Newcomer notice"
                  value={churchForm.newcomer_notice ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, newcomer_notice: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Data protection notice"
                  value={churchForm.data_protection_notice ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, data_protection_notice: e.target.value }))
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
                Used on the public Service Details section. Distinct from the
                secretary&apos;s correspondence address above so newcomers see
                the venue, not the postal address.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Textarea
                  placeholder="Service venue (e.g. Mark members Hall, 86 St James's Street, London)"
                  value={churchForm.service_location ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, service_location: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Service venue map link (e.g. https://maps.app.goo.gl/…)"
                  value={churchForm.service_location_url ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, service_location_url: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Default dress code (e.g. Lounge suit, black tie)"
                  value={churchForm.default_dress_code ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, default_dress_code: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Accessibility notes (step-free access, hearing loop, parking…)"
                  value={churchForm.accessibility_notes ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({ ...prev, accessibility_notes: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
              </div>
            </div>

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Gift Aid &amp; Gift Aid pack
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                Tells ChurchPay how to collect Gift Aid declarations and where
                to forward the claim pack after each service close. Required
                fields for the HMRC reclaim end up in MANIFEST.txt of every
                downloaded pack.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-[0.16em] text-dash-faint">
                    Default declaration capture
                  </label>
                  <Select
                    value={churchForm.gift_aid_default_mode ?? "both"}
                    onValueChange={(value) =>
                      setChurchForm((prev) => ({
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
                    Paper-friendly churches (Lester&apos;s rule) should pick
                    &quot;Both&quot; or &quot;Paper only&quot; so the on-the-day
                    capture flow stays in front of treasurers.
                  </p>
                </div>
                <Input
                  placeholder="Gift Aid pack name (e.g. Network Grand Charity)"
                  value={churchForm.gift_aid_pack_name ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({
                      ...prev,
                      gift_aid_pack_name: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Gift Aid pack email (where you forward the pack)"
                  type="email"
                  value={churchForm.gift_aid_pack_email ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({
                      ...prev,
                      gift_aid_pack_email: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Gift Aid pack charity number"
                  value={churchForm.gift_aid_pack_charity_number ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({
                      ...prev,
                      gift_aid_pack_charity_number: e.target.value,
                    }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="HMRC charity reference (e.g. XR12345)"
                  value={churchForm.hmrc_charity_reference ?? ""}
                  onChange={(e) =>
                    setChurchForm((prev) => ({
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
                onClick={saveChurch}
                disabled={savingChurch || !selectedChurch}
                className="gap-2"
              >
                {savingChurch ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingChurch ? "Saving…" : "Save Church Profile"}
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
