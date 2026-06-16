"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  MosqueSiteFooterLinkGroup,
  MosqueSiteFooterSettings,
} from "@/lib/db/types";
import { DEMO_MOSQUE_NAME } from "@/lib/demo-mosque";
import { defaultFooterSettings } from "@/lib/site-section-style";
import { cn } from "@/lib/utils";

const FOOTER_PRESETS = [
  {
    id: "simple",
    name: "Simple footer",
    description: "Logo, contact details, and the main pages.",
    groups: [
      footerGroup("Explore", 1, [
        ["Home", "/"],
        ["About", "/site/about"],
        ["Events", "/events"],
        ["Contact", "/site/contact"],
      ]),
    ],
  },
  {
    id: "full",
    name: "Full footer",
    description: "Best for mosques with joining, charity, events, and newcomer pages.",
    groups: [
      footerGroup("Explore", 1, [
        ["About", "/site/about"],
        ["Events", "/events"],
        ["Charity", "/site/charity"],
      ]),
      footerGroup("Newcomers", 2, [
        ["Visit us", "/site/newcomers"],
        ["Join", "/site/join"],
        ["Contact", "/site/contact"],
      ]),
    ],
  },
  {
    id: "contact",
    name: "Contact focused",
    description: "Best when the site should drive enquiries and joining interest.",
    groups: [
      footerGroup("Get in touch", 1, [
        ["Contact", "/site/contact"],
        ["Join the mosque", "/site/join"],
        ["Visit a service", "/site/newcomers"],
      ]),
    ],
  },
] as const;

function footerGroup(
  title: string,
  order: number,
  links: Array<[label: string, href: string]>
): MosqueSiteFooterLinkGroup {
  return {
    id: crypto.randomUUID(),
    title,
    order,
    links: links.map(([label, href], index) => ({
      id: crypto.randomUUID(),
      label,
      href,
      visible: true,
      order: index + 1,
    })),
  };
}

function cloneFooterGroups(groups: readonly MosqueSiteFooterLinkGroup[]) {
  return groups.map((group, groupIndex) => ({
    ...group,
    id: crypto.randomUUID(),
    order: groupIndex + 1,
    links: group.links.map((link, linkIndex) => ({
      ...link,
      id: crypto.randomUUID(),
      order: linkIndex + 1,
    })),
  }));
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

function FooterPreview({
  settings,
  mosqueName,
  mosqueNumber,
  city,
  tagline,
  supportEmail,
  supportPhone,
  logoUrl,
}: {
  settings: MosqueSiteFooterSettings;
  mosqueName: string;
  mosqueNumber?: string | null;
  city?: string | null;
  tagline?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  logoUrl?: string | null;
}) {
  const groups = settings.link_groups
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((group) => ({
      ...group,
      links: group.links
        .filter((link) => link.visible)
        .slice()
        .sort((a, b) => a.order - b.order),
    }))
    .filter((group) => group.links.length > 0);
  const footerTagline =
    settings.tagline ??
    tagline ??
    "A mosque website with services, charity, membership enquiries, and contact details.";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-white shadow-dash">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Live footer preview
          </p>
          <p className="mt-1 text-sm text-slate-300">
            Footer columns, small print, and contact details update here.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Public site
        </span>
      </div>

      <footer className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr_1fr]">
          <div>
            <div className="mb-4 flex items-center gap-3">
              {settings.show_logo ? (
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.18em]">
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
                <div>
                  {settings.show_mosque_name ? (
                    <p className="text-base font-semibold tracking-tight">{mosqueName}</p>
                  ) : null}
                  {settings.show_mosque_number ? (
                    <p className="text-sm text-slate-400">
                      {[mosqueNumber ? `No. ${mosqueNumber}` : null, city].filter(Boolean).join(" / ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">{footerTagline}</p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
              {settings.badge_text ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {settings.badge_text}
                </span>
              ) : null}
              {settings.show_contact_details && supportEmail ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {supportEmail}
                </span>
              ) : null}
              {settings.show_contact_details && supportPhone ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  {supportPhone}
                </span>
              ) : null}
            </div>
          </div>

          {groups.slice(0, 2).map((group) => (
            <div key={group.id}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                {group.title}
              </p>
              <div className="grid gap-3">
                {group.links.slice(0, 6).map((link) => (
                  <span key={link.id} className="text-sm text-slate-400">
                    {link.label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 border-t border-white/10 pt-6 text-xs text-slate-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>(c) {new Date().getFullYear()} {mosqueName}. All rights reserved.</span>
            {settings.show_powered_by !== false ? (
              <a
                href="https://mosque-pay.com"
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-slate-300"
              >
                Powered by MosquePay
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}

export function FooterSettingsManager({
  mosqueSlug,
  initialSettings,
  mosqueName,
  mosqueNumber,
  city,
  tagline,
  supportEmail,
  supportPhone,
  logoUrl,
}: {
  mosqueSlug: string;
  initialSettings?: MosqueSiteFooterSettings | null;
  mosqueName?: string;
  mosqueNumber?: string | null;
  city?: string | null;
  tagline?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  logoUrl?: string | null;
}) {
  const previewMosqueName = mosqueName ?? DEMO_MOSQUE_NAME;
  const [settings, setSettings] = useState<MosqueSiteFooterSettings>(
    initialSettings ?? defaultFooterSettings()
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const linkGroups = useMemo(
    () => settings.link_groups.slice().sort((a, b) => a.order - b.order),
    [settings.link_groups]
  );

  function updateGroup(id: string, patch: Partial<MosqueSiteFooterLinkGroup>) {
    setSettings((current) => ({
      ...current,
      link_groups: current.link_groups.map((group) =>
        group.id === id ? { ...group, ...patch } : group
      ),
    }));
  }

  function addGroup() {
    setSettings((current) => ({
      ...current,
      link_groups: [
        ...current.link_groups,
        {
          id: crypto.randomUUID(),
          title: "New group",
          order: current.link_groups.length + 1,
          links: [
            {
              id: crypto.randomUUID(),
              label: "New link",
              href: "/",
              visible: true,
              order: 1,
            },
          ],
        },
      ],
    }));
  }

  function removeGroup(id: string) {
    setSettings((current) => ({
      ...current,
      link_groups: current.link_groups
        .filter((group) => group.id !== id)
        .map((group, index) => ({ ...group, order: index + 1 })),
    }));
  }

  function addLink(groupId: string) {
    setSettings((current) => ({
      ...current,
      link_groups: current.link_groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              links: [
                ...group.links,
                {
                  id: crypto.randomUUID(),
                  label: "New link",
                  href: "/",
                  visible: true,
                  order: group.links.length + 1,
                },
              ],
            }
          : group
      ),
    }));
  }

  function updateLink(
    groupId: string,
    linkId: string,
    patch: Partial<MosqueSiteFooterLinkGroup["links"][number]>
  ) {
    setSettings((current) => ({
      ...current,
      link_groups: current.link_groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              links: group.links.map((link) =>
                link.id === linkId ? { ...link, ...patch } : link
              ),
            }
          : group
      ),
    }));
  }

  function removeLink(groupId: string, linkId: string) {
    setSettings((current) => ({
      ...current,
      link_groups: current.link_groups.map((group) =>
        group.id === groupId
          ? {
              ...group,
              links: group.links
                .filter((link) => link.id !== linkId)
                .map((link, index) => ({ ...link, order: index + 1 })),
            }
          : group
      ),
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/mosques/${mosqueSlug}/site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ footer_settings: settings }),
      });
      if (!response.ok) throw new Error("Could not save footer settings.");
      setMessage("Footer settings saved.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save footer settings."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-surface p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dash-text">Website footer</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Control footer branding, contact visibility, small print, and link groups.
          </p>
        </div>
        <Button type="button" onClick={save} disabled={saving} variant="primary">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save footer
        </Button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.9fr)]">
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {[
              ["show_logo", "Show logo"],
              ["show_mosque_name", "Show mosque name"],
              ["show_mosque_number", "Show mosque number"],
              ["show_contact_details", "Show contact details"],
              ["show_powered_by", "Show \"Powered by MosquePay\""],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-3 text-sm text-dash-text"
              >
                <input
                  type="checkbox"
                  checked={Boolean(settings[key as keyof MosqueSiteFooterSettings])}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {label}
              </label>
            ))}
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
            <h3 className="text-sm font-semibold text-dash-text">Choose a footer layout</h3>
            <p className="mt-1 text-xs text-dash-muted">
              Start with a ready-made footer. You can still fine tune the links below.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {FOOTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    setSettings((current) => ({
                      ...current,
                      link_groups: cloneFooterGroups(preset.groups),
                    }))
                  }
                  className="rounded-xl border border-dash-border bg-dash-surface p-3 text-left transition hover:border-dash-ring/60 hover:bg-dash-ring/10"
                >
                  <p className="text-sm font-semibold text-dash-text">{preset.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-dash-muted">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-dash-muted">Footer tagline</label>
              <Textarea
                value={settings.tagline ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    tagline: event.target.value || null,
                  }))
                }
                placeholder="A short sentence about the mosque."
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-dash-muted">Footer badge</label>
              <Input
                value={settings.badge_text ?? ""}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    badge_text: event.target.value || null,
                  }))
                }
                placeholder="Member website"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-dash-text">Footer menu</h3>
                <p className="mt-1 text-xs text-dash-muted">
                  These are the columns newcomers see at the bottom of the site.
                </p>
              </div>
              <Button type="button" variant="dashboard" size="sm" onClick={addGroup}>
                <Plus className="mr-2 h-4 w-4" />
                Add group
              </Button>
            </div>

            <div className="mt-4 space-y-4">
              {linkGroups.map((group, groupIndex) => (
                <div
                  key={group.id}
                  className="rounded-2xl border border-dash-border bg-dash-surface p-4"
                >
                  <div className="grid gap-3 lg:grid-cols-[4rem_1fr_auto_auto]">
                    <Input
                      type="number"
                      min={1}
                      value={group.order}
                      onChange={(event) =>
                        updateGroup(group.id, {
                          order: Number(event.target.value) || groupIndex + 1,
                        })
                      }
                      aria-label="Group order"
                    />
                    <Input
                      value={group.title}
                      onChange={(event) => updateGroup(group.id, { title: event.target.value })}
                      placeholder="Explore"
                    />
                    <Button
                      type="button"
                      variant="dashboard"
                      size="sm"
                      onClick={() => addLink(group.id)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeGroup(group.id)}
                      aria-label="Remove group"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>

                  <div className="mt-3 space-y-3">
                    {group.links
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((link, linkIndex) => (
                        <div
                          key={link.id}
                          className={cn(
                            "grid gap-3 rounded-xl border bg-dash-surface-subtle p-3 lg:grid-cols-[4rem_1fr_1fr_auto_auto]",
                            link.visible ? "border-dash-border" : "border-dash-border opacity-60"
                          )}
                        >
                          <Input
                            type="number"
                            min={1}
                            value={link.order}
                            onChange={(event) =>
                              updateLink(group.id, link.id, {
                                order: Number(event.target.value) || linkIndex + 1,
                              })
                            }
                            aria-label="Link order"
                          />
                          <Input
                            value={link.label}
                            onChange={(event) =>
                              updateLink(group.id, link.id, { label: event.target.value })
                            }
                            placeholder="Label"
                          />
                          <Input
                            value={link.href}
                            onChange={(event) =>
                              updateLink(group.id, link.id, { href: event.target.value })
                            }
                            placeholder="/site/about"
                          />
                          <label className="flex items-center gap-2 text-sm text-dash-text">
                            <input
                              type="checkbox"
                              checked={link.visible}
                              onChange={(event) =>
                                updateLink(group.id, link.id, {
                                  visible: event.target.checked,
                                })
                              }
                            />
                            Visible
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLink(group.id, link.id)}
                            aria-label="Remove link"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <FooterPreview
          settings={settings}
          mosqueName={previewMosqueName}
          mosqueNumber={mosqueNumber}
          city={city}
          tagline={tagline}
          supportEmail={supportEmail}
          supportPhone={supportPhone}
          logoUrl={logoUrl}
        />
      </div>

      {message ? <p className="mt-4 text-sm text-dash-muted">{message}</p> : null}
    </div>
  );
}
