"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MosqueSiteHeaderSettings } from "@/lib/db/types";
import { DEMO_MOSQUE_NAME } from "@/lib/demo-mosque";
import { defaultHeaderSettings } from "@/lib/site-section-style";
import { cn } from "@/lib/utils";

const DESTINATIONS = [
  { id: "home", label: "Home page", href: "/", suggestedLabel: "Home" },
  { id: "about", label: "About page", href: "/site/about", suggestedLabel: "About" },
  { id: "events", label: "Events calendar", href: "/events", suggestedLabel: "Events" },
  { id: "charity", label: "Charity page", href: "/site/charity", suggestedLabel: "Charity" },
  { id: "join", label: "Join or visit page", href: "/site/join", suggestedLabel: "Join" },
  { id: "contact", label: "Contact page", href: "/site/contact", suggestedLabel: "Contact" },
  { id: "custom", label: "Custom link", href: "custom", suggestedLabel: "Custom link" },
] as const;

function destinationIdForHref(href: string | null | undefined) {
  return DESTINATIONS.find((item) => item.href === href)?.id ?? "custom";
}

function initialsFromName(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "LG";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

function HeaderPreview({
  settings,
  mosqueName,
  mosqueNumber,
  logoUrl,
  primaryColor,
}: {
  settings: MosqueSiteHeaderSettings;
  mosqueName: string;
  mosqueNumber?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
}) {
  const visibleLinks = settings.nav_items
    .filter((item) => item.visible)
    .slice()
    .sort((a, b) => a.order - b.order);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-white shadow-dash">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Live header preview
          </p>
          <p className="mt-1 text-sm text-slate-300">
            This updates as you edit the controls.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Desktop
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-5 border-b border-slate-200 bg-white/95 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {settings.show_logo ? (
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl text-xs font-bold tracking-[0.18em] text-white shadow-lg"
                style={{ backgroundColor: primaryColor }}
              >
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={`${mosqueName} logo`}
                    width={44}
                    height={44}
                    unoptimized
                    className="h-full w-full bg-white object-contain p-1"
                  />
                ) : (
                  initialsFromName(mosqueName)
                )}
              </div>
            ) : null}
            {(settings.show_mosque_name || settings.show_mosque_number) ? (
              <div className="min-w-0">
                {settings.show_mosque_name ? (
                  <p className="truncate text-sm font-semibold text-slate-950">{mosqueName}</p>
                ) : null}
                {settings.show_mosque_number && mosqueNumber ? (
                  <p className="text-xs text-slate-500">No. {mosqueNumber}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <nav className="hidden min-w-0 items-center justify-end gap-5 md:flex">
            {visibleLinks.slice(0, 6).map((item) => (
              <span key={item.id} className="truncate text-xs font-medium text-slate-600">
                {item.label}
              </span>
            ))}
            {settings.cta_label ? (
              <span
                className="rounded-full px-4 py-2 text-xs font-semibold text-white shadow-md"
                style={{ backgroundColor: primaryColor }}
              >
                {settings.cta_label}
              </span>
            ) : null}
          </nav>
        </header>

        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-6 py-12 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Page starts below header
          </p>
          <p className="mx-auto mt-3 max-w-md text-2xl font-semibold tracking-tight text-white">
            Newcomers see this navigation before your first section.
          </p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            {settings.show_logo ? (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[10px] font-bold tracking-[0.16em] text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {initialsFromName(mosqueName)}
              </div>
            ) : null}
            <span className="text-xs font-semibold text-slate-950">
              {settings.show_mosque_name ? mosqueName : "Mosque website"}
            </span>
          </div>
          <span className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-700">
            Menu
          </span>
        </div>
      </div>
    </div>
  );
}

export function HeaderSettingsManager({
  mosqueSlug,
  initialSettings,
  mosqueName,
  mosqueNumber,
  logoUrl,
  primaryColor = "#3b82f6",
}: {
  mosqueSlug: string;
  initialSettings?: MosqueSiteHeaderSettings | null;
  mosqueName?: string;
  mosqueNumber?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
}) {
  const previewMosqueName = mosqueName ?? DEMO_MOSQUE_NAME;
  const [settings, setSettings] = useState<MosqueSiteHeaderSettings>(
    initialSettings ?? defaultHeaderSettings()
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const navItems = useMemo(
    () => settings.nav_items.slice().sort((a, b) => a.order - b.order),
    [settings.nav_items]
  );

  function updateNavItem(id: string, patch: Partial<(typeof navItems)[number]>) {
    setSettings((current) => ({
      ...current,
      nav_items: current.nav_items.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      ),
    }));
  }

  function updateNavDestination(id: string, destinationId: string) {
    const destination = DESTINATIONS.find((item) => item.id === destinationId);
    if (!destination) return;
    updateNavItem(
      id,
      destination.id === "custom"
        ? { label: destination.suggestedLabel }
        : {
            href: destination.href,
            label: destination.suggestedLabel,
          }
    );
  }

  function addNavItem() {
    const nextOrder = navItems.length + 1;
    setSettings((current) => ({
      ...current,
      nav_items: [
        ...current.nav_items,
        {
          id: crypto.randomUUID(),
          label: "New link",
          href: "/",
          visible: true,
          order: nextOrder,
        },
      ],
    }));
  }

  function removeNavItem(id: string) {
    setSettings((current) => ({
      ...current,
      nav_items: current.nav_items
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, order: index + 1 })),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/mosques/${mosqueSlug}/site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header_settings: settings }),
      });
      if (!response.ok) throw new Error("Could not save header settings.");
      setMessage("Header settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save header settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-surface p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dash-text">Website header</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Control what appears in the public mosque site header.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} variant="primary">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save header
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-3 text-sm text-dash-text">
              <input
                type="checkbox"
                checked={settings.show_logo}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, show_logo: event.target.checked }))
                }
              />
              Show logo
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-3 text-sm text-dash-text">
              <input
                type="checkbox"
                checked={settings.show_mosque_name}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    show_mosque_name: event.target.checked,
                  }))
                }
              />
              Show mosque name
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-3 text-sm text-dash-text">
              <input
                type="checkbox"
                checked={settings.show_mosque_number}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    show_mosque_number: event.target.checked,
                  }))
                }
              />
              Show mosque number
            </label>
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-dash-text">Menu items</h3>
                <p className="mt-1 text-xs text-dash-muted">
                  Choose where each menu item should take newcomers. No website paths needed.
                </p>
              </div>
              <Button type="button" variant="dashboard" size="sm" onClick={addNavItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add link
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {navItems.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "grid gap-3 rounded-xl border bg-dash-surface p-3 lg:grid-cols-[4rem_1fr_1fr_auto_auto]",
                    item.visible ? "border-dash-border" : "border-dash-border opacity-60"
                  )}
                >
                  <Input
                    type="number"
                    min={1}
                    value={item.order}
                    onChange={(event) =>
                      updateNavItem(item.id, {
                        order: Number(event.target.value) || index + 1,
                      })
                    }
                    aria-label="Navigation order"
                  />
                  <Input
                    value={item.label}
                    onChange={(event) => updateNavItem(item.id, { label: event.target.value })}
                    placeholder="Menu label"
                  />
                  <div className="space-y-2">
                    <select
                      value={destinationIdForHref(item.href)}
                      onChange={(event) => updateNavDestination(item.id, event.target.value)}
                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
                      aria-label="Menu destination"
                    >
                      {DESTINATIONS.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.label}
                        </option>
                      ))}
                    </select>
                    {destinationIdForHref(item.href) === "custom" ? (
                      <Input
                        value={item.href}
                        onChange={(event) => updateNavItem(item.id, { href: event.target.value })}
                        placeholder="https://example.org or /site/page"
                        aria-label="Custom link destination"
                      />
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-dash-text">
                    <input
                      type="checkbox"
                      checked={item.visible}
                      onChange={(event) =>
                        updateNavItem(item.id, { visible: event.target.checked })
                      }
                    />
                    Visible
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeNavItem(item.id)}
                    aria-label="Remove link"
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">Header button label</label>
              <Input
                value={settings.cta_label ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    cta_label: event.target.value || null,
                  }))
                }
                placeholder="Join Us"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">Header button destination</label>
              <select
                value={destinationIdForHref(settings.cta_href)}
                onChange={(event) => {
                  const destination = DESTINATIONS.find((item) => item.id === event.target.value);
                  setSettings((current) => ({
                    ...current,
                    cta_href: destination?.href === "custom" ? current.cta_href : destination?.href ?? null,
                  }));
                }}
                className="h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text"
              >
                {DESTINATIONS.filter((item) => item.id !== "home").map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.label}
                  </option>
                ))}
              </select>
              {destinationIdForHref(settings.cta_href) === "custom" ? (
                <Input
                  className="mt-2"
                  value={settings.cta_href ?? ""}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      cta_href: event.target.value || null,
                    }))
                  }
                  placeholder="https://example.org or /site/page"
                />
              ) : null}
            </div>
          </div>
        </div>
        <HeaderPreview
          settings={settings}
          mosqueName={previewMosqueName}
          mosqueNumber={mosqueNumber}
          logoUrl={logoUrl}
          primaryColor={primaryColor}
        />
      </div>

      {message ? <p className="mt-4 text-sm text-dash-muted">{message}</p> : null}
    </div>
  );
}
