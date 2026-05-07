"use client";

import type React from "react";
import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
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
import type { Lodge, LodgeSitePage } from "@/lib/db/types";

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
  lodge,
  site,
  blog,
}: {
  lodge: Lodge;
  site: LodgeSitePage | null;
  blog: React.ReactNode;
}) {
  const [brand, setBrand] = useState({
    primary_color: lodge.primary_color ?? "",
    secondary_color: lodge.secondary_color ?? "",
    logo_url: lodge.logo_url ?? "",
  });
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMessage, setBrandMessage] = useState<string | null>(null);

  async function saveBrand() {
    setSavingBrand(true);
    setBrandMessage(null);
    try {
      const response = await fetch("/api/lodges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: lodge.slug,
          name: lodge.name,
          city: lodge.city,
          country: lodge.country,
          tagline: lodge.tagline,
          support_email: lodge.support_email,
          support_phone: lodge.support_phone,
          logo_url: brand.logo_url.trim() || null,
          lodge_number: lodge.lodge_number,
          consecrated_at: lodge.consecrated_at,
          governing_body: lodge.governing_body,
          meeting_schedule: lodge.meeting_schedule,
          secretary_name: lodge.secretary_name,
          secretary_address: lodge.secretary_address,
          secretary_phone: lodge.secretary_phone,
          data_protection_notice: lodge.data_protection_notice,
          visiting_notice: lodge.visiting_notice,
          loi_contact: lodge.loi_contact,
          primary_color: brand.primary_color.trim() || null,
          secondary_color: brand.secondary_color.trim() || null,
          is_active: lodge.is_active,
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
    lodge_id: lodge.id,
    page_key: "home",
    page_title: lodge.name,
    page_description: lodge.tagline,
    sections: [],
    published: false,
    updated_at: new Date().toISOString(),
  };

  return (
    <Tabs defaultValue="builder" className="space-y-6">
      <TabsList>
        <TabsTrigger value="builder">Builder</TabsTrigger>
        <TabsTrigger value="brand">Brand</TabsTrigger>
        <TabsTrigger value="blog">Blog</TabsTrigger>
        <TabsTrigger value="domains">Domains</TabsTrigger>
        <TabsTrigger value="launch">Launch checklist</TabsTrigger>
      </TabsList>

      <TabsContent value="builder">
        <div className="admin-surface overflow-hidden p-6">
          <SimpleSiteBuilder
            lodgeSlug={lodge.slug}
            initialSections={siteDraft.sections}
            pageTitle={siteDraft.page_title}
            pageDescription={siteDraft.page_description}
            primaryColor={brand.primary_color || "#3b82f6"}
            initiallyPublished={siteDraft.published}
            publicHref={`/?lodge=${lodge.slug}`}
          />
        </div>
      </TabsContent>

      <TabsContent value="brand">
        <div className="admin-surface p-6">
          <h2 className="text-lg font-semibold text-dash-text">Website brand</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Set the colours and logo used by the public lodge website.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-medium text-dash-muted">Logo URL</label>
              <Input
                value={brand.logo_url}
                onChange={(event) =>
                  setBrand((current) => ({ ...current, logo_url: event.target.value }))
                }
                placeholder="https://..."
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

      <TabsContent value="blog">{blog}</TabsContent>

      <TabsContent value="domains">
        <CustomDomainCard />
      </TabsContent>

      <TabsContent value="launch">
        <div className="admin-surface p-6">
          <h2 className="text-lg font-semibold text-dash-text">Website launch checklist</h2>
          <p className="mt-1 text-sm text-dash-muted">
            Complete these before publishing the public homepage.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              "Confirm lodge name, city, email, phone, and logo.",
              "Set brand colours that match lodge or province guidance.",
              "Review hero, meeting details, charity, join, and contact sections.",
              "Use the AI draft panel for a first pass, then edit wording manually.",
              "Preview the public lodge site before sharing links.",
              "Keep member-only details inside the member portal and summons.",
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
      </TabsContent>
    </Tabs>
  );
}
