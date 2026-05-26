"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolveLodgeSlug } from "@/lib/tenant";
import type { LodgeSiteFooterSettings } from "@/lib/db/types";
import { defaultFooterSettings } from "@/lib/site-section-style";

const marketingLinks = {
  main: [
    { href: "/features", label: "Features" },
    { href: "/book-demo", label: "Book Demo" },
  ],
  secondary: [
    { href: "/faq", label: "FAQs" },
    { href: "/contact#contact-form", label: "Technical support" },
    { href: "/contact", label: "Contact" },
  ],
};

type LodgeBranding = {
  slug: string;
  name: string;
  city: string | null;
  tagline: string | null;
  logo_url: string | null;
  lodge_number: string | null;
  support_email: string | null;
  support_phone: string | null;
};

function initialsFromName(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length === 0) return "LG";
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export function PublicFooter({
  initialBranding = null,
  initialFooterSettings = null,
  initialTenantSlug = null,
}: {
  initialBranding?: LodgeBranding | null;
  initialFooterSettings?: LodgeSiteFooterSettings | null;
  initialTenantSlug?: string | null;
}) {
  const searchParams = useSearchParams();
  const [branding, setBranding] = useState<LodgeBranding | null>(initialBranding);
  const [hostTenantSlug, setHostTenantSlug] = useState<string | null>(initialTenantSlug);
  const [footerSettings, setFooterSettings] = useState<LodgeSiteFooterSettings | null>(
    initialFooterSettings
  );
  const rawLodgeQuery = searchParams.get("lodge");
  const queryTenantMode = Boolean(rawLodgeQuery);
  const isTenantMode = queryTenantMode || Boolean(hostTenantSlug);
  const lodgeSlug = useMemo(
    () => hostTenantSlug ?? resolveLodgeSlug(rawLodgeQuery),
    [hostTenantSlug, rawLodgeQuery]
  );
  const settings = footerSettings ?? defaultFooterSettings();
  const tenantFooterGroups = settings.link_groups
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
  const marketingFooterGroups = [
    { id: "main", title: "Explore", links: marketingLinks.main },
    { id: "secondary", title: "More", links: marketingLinks.secondary },
  ];
  const footerGroups = isTenantMode ? tenantFooterGroups : marketingFooterGroups;
  const withTenantQuery = (href: string) =>
    isTenantMode && href.startsWith("/")
      ? `${href}${href.includes("?") ? "&" : "?"}lodge=${encodeURIComponent(lodgeSlug)}`
      : href;

  useEffect(() => {
    if (initialBranding && initialTenantSlug === lodgeSlug) return;

    let active = true;
    async function loadBranding() {
      try {
        const res = await fetch(
          queryTenantMode
            ? `/api/lodges/${lodgeSlug}/site`
            : "/api/lodges/current/site"
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const lodge = data.lodge as LodgeBranding | null;
        const siteFooterSettings = data.site?.footer_settings as
          | LodgeSiteFooterSettings
          | null
          | undefined;
        if (lodge) {
          setBranding(lodge);
          if (!queryTenantMode) setHostTenantSlug(lodge.slug);
        }
        setFooterSettings(siteFooterSettings ?? null);
      } catch {
        // Keep static fallback branding.
      }
    }
    loadBranding();
    return () => {
      active = false;
    };
  }, [initialBranding, initialTenantSlug, lodgeSlug, queryTenantMode]);

  return (
    <footer
      className={
        isTenantMode
          ? "border-t border-slate-800 bg-slate-950 text-white"
          : "border-t border-dash-border bg-dash-surface text-dash-text"
      }
    >
      <div className={isTenantMode ? "container-full py-16 lg:py-20" : "mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20"}>
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-5 flex items-center gap-3">
              {isTenantMode ? (
                <>
                  {settings.show_logo && branding?.logo_url ? (
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm">
                      <Image
                        src={branding.logo_url}
                        alt={`${branding.name} logo`}
                        width={44}
                        height={44}
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                  ) : settings.show_logo ? (
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold tracking-[0.2em]">
                      {initialsFromName(branding?.name ?? "Covenant Lodge")}
                    </div>
                  ) : null}
                  {(settings.show_lodge_name || settings.show_lodge_number) ? (
                    <div>
                      {settings.show_lodge_name ? (
                        <p className="text-base font-semibold tracking-tight">
                          {branding?.name ?? "Covenant Lodge"}
                        </p>
                      ) : null}
                      <p className="text-sm text-slate-400">
                        {[
                          settings.show_lodge_number && branding?.lodge_number
                            ? `No. ${branding.lodge_number}`
                            : null,
                          branding?.city ?? "Mayfair, London",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ) : null}
                </>
              ) : (
                <Image
                  src="/brand/lodgepay-sidebar-logo.png"
                  alt="LodgePay"
                  width={1032}
                  height={245}
                  className="h-9 w-auto max-w-[10rem] object-contain opacity-90"
                />
              )}
            </div>
            <p
              className={
                isTenantMode
                  ? "max-w-md text-sm leading-relaxed text-slate-400"
                  : "max-w-md text-sm leading-relaxed text-dash-muted"
              }
            >
              {isTenantMode
                ? settings.tagline ??
                  branding?.tagline ??
                  "A complete lodge website with visitor information, meetings, charity, membership enquiries, and lodge contact details."
                : "Websites, meetings, summons, dues, charity, Gift Aid, member portal, digital card, candidate CRM, mentoring, Almoner, communications, Treasurer reconciliation, and reporting for Masonic lodges."}
            </p>
            {isTenantMode && (settings.badge_text || settings.show_contact_details) ? (
              <div className="mt-6 flex flex-wrap gap-3 text-xs text-slate-400">
                {settings.badge_text ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    {settings.badge_text}
                  </span>
                ) : null}
                {settings.show_contact_details && branding?.support_email ? (
                  <Link
                    href={`mailto:${branding.support_email}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition-colors hover:text-white"
                  >
                    {branding.support_email}
                  </Link>
                ) : null}
                {settings.show_contact_details && branding?.support_phone ? (
                  <Link
                    href={`tel:${branding.support_phone}`}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 transition-colors hover:text-white"
                  >
                    {branding.support_phone}
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>
          
          {footerGroups.slice(0, 2).map((group) => (
            <div key={group.id} className="lg:col-span-3">
              <p
                className={
                  isTenantMode
                    ? "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                    : "mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-dash-faint"
                }
              >
                {group.title}
              </p>
              <nav className="flex flex-col gap-3">
                {group.links.map((link) => (
                  <Link
                    key={`${group.id}-${link.href}`}
                    href={withTenantQuery(link.href)}
                    className={
                      isTenantMode
                        ? "text-sm text-slate-400 transition-colors hover:text-white"
                        : "text-sm text-dash-muted transition-colors hover:text-dash-text"
                    }
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          ))}
        </div>
        
        <div
          className={
            isTenantMode
              ? "mt-16 border-t border-white/10 pt-8"
              : "mt-16 border-t border-dash-border pt-8"
          }
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className={isTenantMode ? "text-xs text-slate-500" : "text-xs text-dash-faint"}>
              © {new Date().getFullYear()} {isTenantMode ? branding?.name ?? "Covenant Lodge No. 4344" : "LodgePay"}.
              {" "}All rights reserved.
            </p>
            <div className={isTenantMode ? "flex flex-wrap gap-5 text-xs text-slate-500" : "flex flex-wrap gap-5 text-xs text-dash-faint"}>
              {isTenantMode ? (
                settings.show_powered_by !== false ? (
                  <Link
                    href="https://lodgepayments.co.uk"
                    className="transition-colors hover:text-slate-300"
                  >
                    Powered by LodgePay
                  </Link>
                ) : null
              ) : (
                <>
                  <Link href="/privacy" className="transition-colors hover:text-dash-muted">
                    Privacy
                  </Link>
                  <Link href="/terms" className="transition-colors hover:text-dash-muted">
                    Terms
                  </Link>
                  <Link href="/gdpr" className="transition-colors hover:text-dash-muted">
                    GDPR
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
