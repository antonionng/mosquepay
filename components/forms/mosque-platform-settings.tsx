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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mosque = {
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  logo_url: string | null;
  mosque_number: string | null;
  consecrated_at: string | null;
  governing_body: string | null;
  service_schedule: string | null;
  secretary_name: string | null;
  secretary_address: string | null;
  secretary_phone: string | null;
  data_protection_notice: string | null;
  newcomer_notice: string | null;
  loi_contact: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  is_active: boolean;
};

type AdminMosqueContext = {
  selectedSlug: string;
  mosques: Mosque[];
};


// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function MosquePlatformSettings() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [mosqueForm, setMosqueForm] = useState<Partial<Mosque>>({});
  const [status, setStatus] = useState<string>("");
  const [statusType, setStatusType] = useState<"info" | "error" | "success">("info");
  const [loading, setLoading] = useState(true);
  const [savingMosque, setSavingMosque] = useState(false);

  const selectedMosque = useMemo(
    () => mosques.find((mosque) => mosque.slug === selectedSlug) ?? null,
    [mosques, selectedSlug]
  );

  const flash = useCallback(
    (msg: string, type: "info" | "error" | "success" = "info") => {
      setStatus(msg);
      setStatusType(type);
    },
    []
  );

  const syncAdminMosqueContext = useCallback(async (mosqueSlug: string) => {
    await fetch("/api/admin/mosque-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mosque_slug: mosqueSlug }),
    });
  }, []);

  useEffect(() => {
    async function loadMosques() {
      setLoading(true);
      flash("");
      try {
        const res = await fetch("/api/admin/mosque-context");
        if (!res.ok) throw new Error("Failed to load mosques");
        const data = (await res.json()) as AdminMosqueContext;
        const requestedSlug = new URLSearchParams(window.location.search).get("mosque");
        const requestedMosque = requestedSlug
          ? data.mosques.find((mosque) => mosque.slug === requestedSlug)
          : null;
        const selected = requestedMosque?.slug ?? data.selectedSlug;
        setMosques(data.mosques);
        if (selected) {
          const mosque =
            data.mosques.find((item) => item.slug === selected) ?? data.mosques[0];
          setSelectedSlug(mosque.slug);
          setMosqueForm(mosque);
          if (requestedMosque && requestedMosque.slug !== data.selectedSlug) {
            await syncAdminMosqueContext(requestedMosque.slug);
          }
        }
      } catch {
        flash("Could not load mosques.", "error");
      } finally {
        setLoading(false);
      }
    }
    loadMosques();
  }, [flash, syncAdminMosqueContext]);

  useEffect(() => {
    if (!selectedSlug) return;
    const mosque = mosques.find((item) => item.slug === selectedSlug);
    if (mosque) setMosqueForm(mosque);
  }, [selectedSlug, mosques]);

  async function saveMosque() {
    if (!selectedSlug || !mosqueForm.name?.trim()) {
      flash("Mosque name is required.", "error");
      return;
    }
    setSavingMosque(true);
    flash("");
    try {
      const payload = {
        slug: selectedSlug,
        name: mosqueForm.name.trim(),
        city: mosqueForm.city?.trim() || null,
        country: mosqueForm.country?.trim() || null,
        tagline: mosqueForm.tagline?.trim() || null,
        support_email: mosqueForm.support_email?.trim() || null,
        support_phone: mosqueForm.support_phone?.trim() || null,
        logo_url: mosqueForm.logo_url?.trim() || null,
        mosque_number: mosqueForm.mosque_number?.trim() || null,
        consecrated_at: mosqueForm.consecrated_at?.trim() || null,
        governing_body: mosqueForm.governing_body?.trim() || null,
        service_schedule: mosqueForm.service_schedule?.trim() || null,
        secretary_name: mosqueForm.secretary_name?.trim() || null,
        secretary_address: mosqueForm.secretary_address?.trim() || null,
        secretary_phone: mosqueForm.secretary_phone?.trim() || null,
        data_protection_notice: mosqueForm.data_protection_notice?.trim() || null,
        newcomer_notice: mosqueForm.newcomer_notice?.trim() || null,
        loi_contact: mosqueForm.loi_contact?.trim() || null,
        primary_color: mosqueForm.primary_color?.trim() || null,
        secondary_color: mosqueForm.secondary_color?.trim() || null,
        is_active: mosqueForm.is_active !== false,
      };
      const res = await fetch("/api/mosques", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save mosque");
      const data = await res.json();
      const mosque = data.mosque as Mosque;
      setMosques((prev) =>
        prev.map((item) => (item.slug === mosque.slug ? mosque : item))
      );
      setMosqueForm(mosque);
      flash("Mosque profile saved.", "success");
    } catch {
      flash("Could not save mosque profile.", "error");
    } finally {
      setSavingMosque(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="admin-surface p-6">
        <h2 className="text-lg font-semibold text-dash-text">Mosque Profile</h2>
        <p className="mt-1 text-sm text-dash-muted">
          Manage mosque identity, contact details, and formal notice information.
        </p>

        {loading ? (
          <div className="mt-6 flex items-center gap-3 text-sm text-dash-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading mosques…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.16em] text-dash-faint">
                Mosque
              </label>
              <Select
                value={selectedSlug}
                onValueChange={async (value) => {
                  setSelectedSlug(value);
                  flash("");
                  await syncAdminMosqueContext(value);
                }}
              >
                <SelectTrigger className="border-dash-border bg-dash-surface text-dash-text">
                  <SelectValue placeholder="Select mosque" />
                </SelectTrigger>
                <SelectContent>
                  {mosques.map((mosque) => (
                    <SelectItem key={mosque.slug} value={mosque.slug}>
                      {mosque.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Mosque name"
                value={mosqueForm.name ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Tagline"
                value={mosqueForm.tagline ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({
                    ...prev,
                    tagline: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="City"
                value={mosqueForm.city ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({ ...prev, city: e.target.value }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Country"
                value={mosqueForm.country ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support email"
                value={mosqueForm.support_email ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({
                    ...prev,
                    support_email: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
              <Input
                placeholder="Support phone"
                value={mosqueForm.support_phone ?? ""}
                onChange={(e) =>
                  setMosqueForm((prev) => ({
                    ...prev,
                    support_phone: e.target.value,
                  }))
                }
                className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
              />
            </div>

            <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">
                Formal mosque and notice details
              </h3>
              <p className="mt-1 text-xs leading-5 text-dash-muted">
                These details are used on notice previews, member notice pages,
                and formal mosque communications.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Input
                  placeholder="Mosque number"
                  value={mosqueForm.mosque_number ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, mosque_number: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Governing body"
                  value={mosqueForm.governing_body ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, governing_body: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Established date"
                  type="date"
                  value={mosqueForm.consecrated_at?.slice(0, 10) ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, consecrated_at: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary name"
                  value={mosqueForm.secretary_name ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, secretary_name: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Secretary phone"
                  value={mosqueForm.secretary_phone ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, secretary_phone: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Input
                  placeholder="Study Circle contact"
                  value={mosqueForm.loi_contact ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, loi_contact: e.target.value }))
                  }
                  className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Service schedule"
                  value={mosqueForm.service_schedule ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, service_schedule: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Secretary address"
                  value={mosqueForm.secretary_address ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, secretary_address: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Newcomer notice"
                  value={mosqueForm.newcomer_notice ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, newcomer_notice: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
                <Textarea
                  placeholder="Data protection notice"
                  value={mosqueForm.data_protection_notice ?? ""}
                  onChange={(e) =>
                    setMosqueForm((prev) => ({ ...prev, data_protection_notice: e.target.value }))
                  }
                  className="min-h-24 border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                onClick={saveMosque}
                disabled={savingMosque || !selectedMosque}
                className="gap-2"
              >
                {savingMosque ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingMosque ? "Saving…" : "Save Mosque Profile"}
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
