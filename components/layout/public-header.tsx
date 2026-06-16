"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DEMO_MOSQUE_NAME } from "@/lib/demo-mosque";
import { resolveMosqueSlug } from "@/lib/tenant";
import type { MosqueSiteHeaderSettings } from "@/lib/db/types";
import { defaultHeaderSettings } from "@/lib/site-section-style";
import { useViewerSession } from "@/lib/hooks/use-viewer-session";

type NavLink = {
  href: string;
  label: string;
};

const marketingNavLinks = [
  { href: "/features", label: "Features" },
  { href: "/contact", label: "Contact" },
];

type MosqueBranding = {
  slug: string;
  name: string;
  city: string | null;
  tagline: string | null;
  logo_url: string | null;
  mosque_number: string | null;
};

type TenantNavPage = {
  slug: string;
  title: string;
  nav_label: string | null;
  published: boolean;
  show_in_nav: boolean;
  order: number;
};

function normalizeHref(href: string) {
  const [path] = href.split("?");
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") return "/";
  return trimmed.replace(/\/+$/, "");
}

function linkIntent(link: NavLink) {
  const href = normalizeHref(link.href).toLowerCase();
  const label = link.label.trim().toLowerCase();
  if (href === "/" || label === "home") return "home";
  if (href.includes("/events") || label.includes("event")) return "events";
  if (href.includes("charity") || label.includes("charity")) return "charity";
  if (href.includes("join") || href.includes("visit") || label.includes("join") || label.includes("visit")) {
    return "join";
  }
  if (href.includes("contact") || label.includes("contact")) return "contact";
  if (href.includes("about") || label.includes("about")) return "about";
  return null;
}

function uniqueNavLinks(links: NavLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const hrefKey = `href:${normalizeHref(link.href).toLowerCase()}`;
    const labelKey = `label:${link.label.trim().toLowerCase()}`;
    const intent = linkIntent(link);
    const intentKey = intent ? `intent:${intent}` : null;
    if (seen.has(hrefKey) || seen.has(labelKey) || (intentKey && seen.has(intentKey))) {
      return false;
    }
    seen.add(hrefKey);
    seen.add(labelKey);
    if (intentKey) seen.add(intentKey);
    return true;
  });
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

export function PublicHeader({
  initialBranding = null,
  initialHeaderSettings = null,
  initialCustomPages = [],
  initialTenantSlug = null,
}: {
  initialBranding?: MosqueBranding | null;
  initialHeaderSettings?: MosqueSiteHeaderSettings | null;
  initialCustomPages?: TenantNavPage[];
  initialTenantSlug?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const viewer = useViewerSession();
  const isAuthed = viewer.status === "admin" || viewer.status === "member";
  const [branding, setBranding] = useState<MosqueBranding | null>(initialBranding);
  const [hostTenantSlug, setHostTenantSlug] = useState<string | null>(initialTenantSlug);
  const [customNavLinks, setCustomNavLinks] = useState<NavLink[]>(
    initialCustomPages
      .filter((page) => page.published && page.show_in_nav)
      .sort((a, b) => a.order - b.order)
      .map((page) => ({
        href: `/site/${page.slug}`,
        label: page.nav_label || page.title,
      }))
  );
  const [headerSettings, setHeaderSettings] = useState<MosqueSiteHeaderSettings>(
    initialHeaderSettings ?? defaultHeaderSettings()
  );
  const isHome = pathname === "/";
  const rawMosqueQuery = searchParams.get("mosque");
  const queryTenantMode = Boolean(rawMosqueQuery);
  const isTenantMode = queryTenantMode || Boolean(hostTenantSlug);
  const mosqueSlug = useMemo(
    () => hostTenantSlug ?? resolveMosqueSlug(rawMosqueQuery),
    [hostTenantSlug, rawMosqueQuery]
  );
  const navLinks = isTenantMode
    ? uniqueNavLinks([
        ...headerSettings.nav_items
          .filter((item) => item.visible)
          .sort((a, b) => a.order - b.order)
          .map((item) => ({ href: item.href, label: item.label })),
        ...customNavLinks,
      ])
    : marketingNavLinks;

  const withTenantQuery = (href: string) =>
    isTenantMode && href.startsWith("/")
      ? `${href}${href.includes("?") ? "&" : "?"}mosque=${encodeURIComponent(mosqueSlug)}`
      : href;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (initialBranding && initialTenantSlug === mosqueSlug) return;

    let active = true;
    async function loadBranding() {
      try {
        const res = await fetch(
          queryTenantMode
            ? `/api/mosques/${mosqueSlug}/site`
            : "/api/mosques/current/site"
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const mosque = data.mosque as MosqueBranding | null;
        const pages = (data.site?.custom_pages ?? []) as TenantNavPage[];
        const settings = (data.site?.header_settings ?? null) as MosqueSiteHeaderSettings | null;
        if (mosque) {
          setBranding(mosque);
          if (!queryTenantMode) setHostTenantSlug(mosque.slug);
        }
        setHeaderSettings(settings ?? defaultHeaderSettings());
        setCustomNavLinks(
          pages
            .filter((page) => page.published && page.show_in_nav)
            .sort((a, b) => a.order - b.order)
            .map((page) => ({
              href: `/site/${page.slug}`,
              label: page.nav_label || page.title,
            }))
        );
      } catch {
        // Keep static fallback branding.
      }
    }
    loadBranding();
    return () => {
      active = false;
    };
  }, [initialBranding, initialTenantSlug, mosqueSlug, queryTenantMode]);

  const solidHeader = scrolled || !isHome;

  if (!isTenantMode) {
    return (
      <header className="sticky top-0 z-50 border-b border-dash-border bg-dash-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 lg:h-[4.25rem] lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/brand/mosquepay-sidebar-logo.png"
              alt="MosquePay"
              width={1032}
              height={245}
              className="h-9 w-auto max-w-[11.5rem] object-contain lg:h-10"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            {marketingNavLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-dash-muted transition-colors hover:text-dash-text"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/book-demo"
              className="rounded-lg border border-dash-border-strong bg-dash-surface px-4 py-2.5 text-sm font-semibold text-dash-text shadow-sm transition-colors hover:border-dash-text/20 hover:bg-dash-surface-subtle"
            >
              Book a demo
            </Link>
            {viewer.status === "loading" ? (
              <span
                aria-hidden
                className="h-[2.625rem] w-24 animate-pulse rounded-lg bg-dash-border/60"
              />
            ) : isAuthed && viewer.destination ? (
              <Link
                href={viewer.destination}
                className="rounded-lg bg-dash-ring px-4 py-2.5 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
              >
                {viewer.label ?? "Open dashboard"}
              </Link>
            ) : (
              <Link
                href="/admin/login"
                className="rounded-lg bg-dash-ring px-4 py-2.5 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
              >
                Login
              </Link>
            )}
          </div>

          <button
            type="button"
            className="rounded-md border border-dash-border bg-dash-surface px-3 py-2 text-xs font-semibold uppercase tracking-wide text-dash-text md:hidden"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-dash-border bg-dash-surface px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {marketingNavLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-surface-subtle"
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-dash-border pt-4">
                <Link
                  href="/book-demo"
                  className="rounded-lg border border-dash-border px-3 py-2.5 text-center text-sm font-semibold"
                  onClick={() => setMobileOpen(false)}
                >
                  Book a demo
                </Link>
                {isAuthed && viewer.destination ? (
                  <Link
                    href={viewer.destination}
                    className="rounded-lg bg-dash-ring py-2.5 text-center text-sm font-semibold text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    {viewer.label ?? "Open dashboard"}
                  </Link>
                ) : (
                  <Link
                    href="/admin/login"
                    className="rounded-lg bg-dash-ring py-2.5 text-center text-sm font-semibold text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>
    );
  }

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-all duration-300",
        isTenantMode
          ? solidHeader
            ? "border-b border-slate-200 bg-white/90 backdrop-blur-xl"
            : "bg-transparent"
          : "border-b border-dash-border bg-dash-surface/95 backdrop-blur-md"
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center justify-between py-3 lg:h-[4.25rem]",
          isTenantMode ? "container-full" : "mx-auto max-w-6xl px-5 lg:px-8"
        )}
      >
        <Link href={withTenantQuery("/")} className="flex items-center gap-3">
          {isTenantMode ? (
            <>
              {headerSettings.show_logo && branding?.logo_url ? (
                <div
                  className={cn(
                    "flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border bg-white shadow-sm transition-colors",
                    isTenantMode && !solidHeader ? "border-white/30" : "border-slate-200"
                  )}
                >
                  <Image
                    src={branding.logo_url}
                    alt={`${branding.name} logo`}
                    width={44}
                    height={44}
                    className="h-full w-full object-contain p-1"
                  />
                </div>
              ) : headerSettings.show_logo ? (
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-semibold tracking-[0.2em] transition-colors",
                    isTenantMode && !solidHeader
                      ? "border-white/20 bg-white/10 text-white"
                      : "border-slate-200 bg-slate-950 text-white"
                  )}
                >
                  {initialsFromName(branding?.name ?? DEMO_MOSQUE_NAME)}
                </div>
              ) : null}
              {headerSettings.show_mosque_name || headerSettings.show_mosque_number ? (
                <div className="min-w-0">
                  {headerSettings.show_mosque_name ? (
                    <p
                      className={cn(
                        "text-sm font-semibold tracking-tight transition-colors",
                        isTenantMode && !solidHeader ? "text-white" : "text-slate-950"
                      )}
                    >
                      {branding?.name ?? DEMO_MOSQUE_NAME}
                    </p>
                  ) : null}
                  {headerSettings.show_mosque_number ? (
                    <p
                      className={cn(
                        "text-xs transition-colors",
                        isTenantMode && !solidHeader ? "text-slate-300" : "text-slate-500"
                      )}
                    >
                      {[
                        branding?.mosque_number ? `No. ${branding.mosque_number}` : null,
                        branding?.city ?? "Mayfair, London",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <Image
              src="/brand/mosquepay-sidebar-logo.png"
              alt="MosquePay"
              width={1032}
              height={245}
              className="h-9 w-auto max-w-[11.5rem] object-contain lg:h-10"
              priority
            />
          )}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={withTenantQuery(link.href)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isTenantMode && !solidHeader
                  ? "text-slate-200 hover:bg-white/10 hover:text-white"
                  : "text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-4 flex items-center gap-3 border-l border-dash-border pl-4">
            {headerSettings.cta_label && headerSettings.cta_href ? (
              <Button
                asChild
                size="sm"
                variant={solidHeader ? "primary" : "secondary"}
                className={cn(
                  isTenantMode && !solidHeader
                    ? "border-white/10 bg-white text-slate-950 hover:bg-slate-100"
                    : "bg-dash-ring text-white hover:bg-dash-ring-dark"
                )}
              >
                <Link href={withTenantQuery(headerSettings.cta_href)}>
                  {headerSettings.cta_label}
                </Link>
              </Button>
            ) : null}
            {!isTenantMode ? (
              viewer.status === "loading" ? (
                <span
                  aria-hidden
                  className="h-9 w-24 animate-pulse rounded-md bg-dash-border/60"
                />
              ) : isAuthed && viewer.destination ? (
                <Button
                  asChild
                  size="sm"
                  className="bg-dash-ring text-white hover:bg-dash-ring-dark"
                >
                  <Link href={viewer.destination}>
                    {viewer.label ?? "Open dashboard"}
                  </Link>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="bg-dash-ring text-white hover:bg-dash-ring-dark"
                >
                  <Link href="/admin/login">Login</Link>
                </Button>
              )
            ) : null}
          </div>
        </nav>

        <button
          className={cn(
            "rounded-xl p-2 transition-colors lg:hidden",
            isTenantMode && !solidHeader
              ? "text-white hover:bg-white/10"
              : "text-dash-muted hover:bg-dash-surface-subtle"
          )}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 top-16 overflow-hidden border-b border-dash-border bg-dash-surface transition-all duration-300 lg:hidden",
          mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav
          className={cn(
            "flex flex-col gap-1 py-4",
            isTenantMode ? "container-full" : "mx-auto max-w-6xl px-5 lg:px-8"
          )}
        >
          {!isTenantMode ? (
            <div className="mb-2 flex items-center gap-2 px-3 py-2">
              <Image
                src="/brand/mosquepay-sidebar-logo.png"
                alt="MosquePay"
                width={1032}
                height={245}
                className="h-8 w-auto max-w-[10rem] object-contain"
              />
            </div>
          ) : null}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={withTenantQuery(link.href)}
              className="rounded-xl px-3 py-3 text-dash-muted transition-colors hover:bg-dash-surface-subtle hover:text-dash-text"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          {headerSettings.cta_label && headerSettings.cta_href ? (
            <div className="mt-3 border-t border-dash-border pt-4">
              <Button asChild className="w-full" variant="primary">
                <Link
                  href={withTenantQuery(headerSettings.cta_href)}
                  onClick={() => setMobileOpen(false)}
                >
                  {headerSettings.cta_label}
                </Link>
              </Button>
            </div>
          ) : null}
            {!isTenantMode ? (
              isAuthed && viewer.destination ? (
                <Button asChild className="mt-2 w-full bg-dash-ring text-white hover:bg-dash-ring-dark">
                  <Link
                    href={viewer.destination}
                    onClick={() => setMobileOpen(false)}
                  >
                    {viewer.label ?? "Open dashboard"}
                  </Link>
                </Button>
              ) : (
                <Button asChild className="mt-2 w-full bg-dash-ring text-white hover:bg-dash-ring-dark">
                  <Link href="/admin/login" onClick={() => setMobileOpen(false)}>
                    Login
                  </Link>
                </Button>
              )
            ) : null}
        </nav>
      </div>
    </header>
  );
}
