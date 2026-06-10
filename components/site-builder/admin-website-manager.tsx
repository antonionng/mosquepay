"use client";

import { useState } from "react";
import { Check, Eye, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CustomDomainCard } from "@/components/admin/custom-domain-card";
import { SimpleSiteBuilder } from "@/components/site-builder/simple-site-builder";
import { MediaLibrary } from "@/components/site-builder/media-library";
import { SitePagesManager } from "@/components/site-builder/site-pages-manager";
import { ImageUploadField } from "@/components/site-builder/image-upload-field";
import { HeaderSettingsManager } from "@/components/site-builder/header-settings-manager";
import { FooterSettingsManager } from "@/components/site-builder/footer-settings-manager";
import { WebsiteReadinessPanel } from "@/components/site-builder/website-readiness-panel";
import type { Church, ChurchSitePage } from "@/lib/db/types";

const THEME_PRESETS = [
  {
    id: "classic-blue",
    name: "Classic blue",
    description: "Crisp, formal, and familiar for most church sites.",
    primary: "#0b43b8",
    secondary: "#082e7d",
  },
  {
    id: "heritage-gold",
    name: "Heritage gold",
    description: "Warm heritage tone for history-led churches.",
    primary: "#92400e",
    secondary: "#111827",
  },
  {
    id: "modern-teal",
    name: "Modern teal",
    description: "Fresh and approachable for recruitment-led pages.",
    primary: "#0f766e",
    secondary: "#134e4a",
  },
  {
    id: "charity-rose",
    name: "Charity rose",
    description: "High-energy palette for campaigns and giving.",
    primary: "#be123c",
    secondary: "#881337",
  },
  {
    id: "premium-dark",
    name: "Premium dark",
    description: "Dark, polished style for premium public presence.",
    primary: "#2563eb",
    secondary: "#0f172a",
  },
];

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
            className="h-10 w-10 rounded-lg border border-dash-border shadow-inner"
            style={{ backgroundColor: value || "#3b82f6" }}
          />
          <input
            type="color"
            value={value || "#3b82f6"}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </div>
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#3b82f6"
        />
      </div>
    </div>
  );
}

export function AdminWebsiteManager({
  church,
  site,
}: {
  church: Church;
  site: ChurchSitePage | null;
}) {
  const [brand, setBrand] = useState({
    primary_color: church.primary_color ?? "",
    secondary_color: church.secondary_color ?? "",
    logo_url: church.logo_url ?? "",
  });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMessage, setBrandMessage] = useState<string | null>(null);

  async function saveBrand() {
    setSavingBrand(true);
    setBrandMessage(null);
    try {
      const response = await fetch("/api/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: church.slug,
          name: church.name,
          city: church.city,
          country: church.country,
          tagline: church.tagline,
          support_email: church.support_email,
          support_phone: church.support_phone,
          logo_url: brand.logo_url.trim() || null,
          church_number: church.church_number,
          consecrated_at: church.consecrated_at,
          governing_body: church.governing_body,
          service_schedule: church.service_schedule,
          secretary_name: church.secretary_name,
          secretary_address: church.secretary_address,
          secretary_phone: church.secretary_phone,
          data_protection_notice: church.data_protection_notice,
          newcomer_notice: church.newcomer_notice,
          loi_contact: church.loi_contact,
          primary_color: brand.primary_color.trim() || null,
          secondary_color: brand.secondary_color.trim() || null,
          is_active: church.is_active,
        }),
      });
      if (!response.ok) throw new Error("Could not save brand settings.");
      setBrandMessage("Brand settings saved.");
    } catch (error) {
      setBrandMessage(
        error instanceof Error ? error.message : "Could not save brand settings."
      );
    } finally {
      setSavingBrand(false);
    }
  }

  const siteDraft = site ?? {
    id: "draft",
    church_id: church.id,
    page_key: "home",
    page_title: church.name,
    page_description: church.tagline,
    sections: [],
    custom_pages: [],
    header_settings: null,
    footer_settings: null,
    published: false,
    updated_at: new Date().toISOString(),
  };

  return (
    <Tabs defaultValue="builder" className="space-y-6">
      <div className="rounded-3xl border border-dash-border bg-dash-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-dash-muted">
              Start here
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-dash-text">
              Launch a beautiful church site with the fewest possible decisions.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-dash-muted">
              Choose a complete site pack in Builder, add logo and colours in Brand, then use Go live to publish and connect the domain.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[30rem]">
            {[
              "Pick site pack",
              "Personalise words and images",
              "Publish and connect domain",
            ].map((label, index) => (
              <div
                key={label}
                className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-3"
              >
                <span className="text-xs font-semibold text-dash-muted">Step {index + 1}</span>
                <p className="mt-1 font-medium text-dash-text">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dash-border bg-dash-surface-subtle p-3">
          <p className="text-sm text-dash-muted">
            Not sure what changed? Open the site in a new tab before sharing it.
          </p>
          <Button asChild type="button" variant="primary" className="rounded-xl">
            <a href={`/?church=${church.slug}`} target="_blank" rel="noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Preview website
            </a>
          </Button>
        </div>
      </div>

      <TabsList>
        <TabsTrigger value="builder">Builder</TabsTrigger>
        <TabsTrigger value="header">Navigation</TabsTrigger>
        <TabsTrigger value="footer">Footer</TabsTrigger>
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="brand">Brand</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="launch">Go live</TabsTrigger>
      </TabsList>

      <TabsContent value="builder">
        <div className="admin-surface overflow-hidden p-6">
          <SimpleSiteBuilder
            churchSlug={church.slug}
            initialSections={siteDraft.sections}
            pageTitle={siteDraft.page_title}
            pageDescription={siteDraft.page_description}
            primaryColor={brand.primary_color || "#3b82f6"}
            initiallyPublished={siteDraft.published}
            publicHref={`/?church=${church.slug}`}
          />
        </div>
      </TabsContent>

      <TabsContent value="header">
        <HeaderSettingsManager
          churchSlug={church.slug}
          initialSettings={siteDraft.header_settings}
          churchName={church.name}
          churchNumber={church.church_number}
          logoUrl={brand.logo_url || church.logo_url}
          primaryColor={brand.primary_color || "#3b82f6"}
        />
      </TabsContent>

      <TabsContent value="footer">
        <FooterSettingsManager
          churchSlug={church.slug}
          initialSettings={siteDraft.footer_settings}
          churchName={church.name}
          churchNumber={church.church_number}
          city={church.city}
          tagline={church.tagline}
          supportEmail={church.support_email}
          supportPhone={church.support_phone}
          logoUrl={brand.logo_url || church.logo_url}
        />
      </TabsContent>

      <TabsContent value="pages">
        <SitePagesManager
          churchSlug={church.slug}
          site={siteDraft}
          primaryColor={brand.primary_color || "#3b82f6"}
        />
      </TabsContent>

      <TabsContent value="media">
        <MediaLibrary />
      </TabsContent>

      <TabsContent value="brand">
        <div className="admin-surface p-6">
          <h2 className="text-lg font-semibold text-dash-text">Website brand</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Set the colours and logo used by the public church website.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <p className="text-xs font-medium text-dash-muted">Theme presets</p>
              <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {THEME_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      setBrand((current) => ({
                        ...current,
                        primary_color: preset.primary,
                        secondary_color: preset.secondary,
                      }))
                    }
                    className="rounded-xl border border-dash-border bg-dash-surface-subtle p-3 text-left transition hover:border-dash-ring/50 hover:bg-dash-surface"
                  >
                    <div className="mb-2 flex gap-1">
                      <span
                        className="h-6 w-10 rounded-md border border-white shadow-sm"
                        style={{ backgroundColor: preset.primary }}
                      />
                      <span
                        className="h-6 w-10 rounded-md border border-white shadow-sm"
                        style={{ backgroundColor: preset.secondary }}
                      />
                    </div>
                    <p className="text-sm font-semibold text-dash-text">{preset.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-dash-muted">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <ColorInput
              label="Primary colour"
              value={brand.primary_color}
              onChange={(value) =>
                setBrand((current) => ({ ...current, primary_color: value }))
              }
            />
            <ColorInput
              label="Secondary colour"
              value={brand.secondary_color}
              onChange={(value) =>
                setBrand((current) => ({ ...current, secondary_color: value }))
              }
            />
            <div className="md:col-span-2">
              <ImageUploadField
                label="Church logo"
                value={brand.logo_url}
                onChange={(value) =>
                  setBrand((current) => ({ ...current, logo_url: value }))
                }
                onClear={() =>
                  setBrand((current) => ({ ...current, logo_url: "" }))
                }
                help="This logo is used on the public church website header, digital member card, and formal notice."
              />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button onClick={saveBrand} disabled={savingBrand} variant="primary">
              {savingBrand ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save brand
            </Button>
            {brandMessage ? (
              <span className="text-sm text-dash-muted">{brandMessage}</span>
            ) : null}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="domains">
        <CustomDomainCard />
      </TabsContent>

      <TabsContent value="launch">
        <div className="space-y-6">
          <WebsiteReadinessPanel />
          <div className="admin-surface p-6">
          <h2 className="text-lg font-semibold text-dash-text">Website launch checklist</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Complete these before publishing the public homepage.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              "Confirm church name, city, email, phone, and logo.",
              "Set brand colours that match church or network guidance.",
              "Review hero, service details, charity, join, and contact sections.",
              "Use the AI draft panel for a first pass, then edit wording manually.",
              "Preview the public church site before sharing links.",
              "Keep member-only details inside the member portal and notice.",
            ].map((item) => (
              <div
                key={item}
                className="flex gap-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-sm text-dash-text"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
