"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveLodgeSlug } from "@/lib/tenant";

const tenantNavLinks = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/charity", label: "Charity" },
  { href: "/news", label: "News" },
  { href: "/contact", label: "Contact" },
];

const marketingNavLinks = [
  { href: "/product", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

type LodgeBranding = {
  name: string;
  city: string | null;
  tagline: string | null;
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

export function PublicHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [branding, setBranding] = useState<LodgeBranding | null>(null);
  const isHome = pathname === "/";
  const rawLodgeQuery = searchParams.get("lodge");
  const isTenantMode = Boolean(rawLodgeQuery);
  const lodgeSlug = useMemo(
    () => resolveLodgeSlug(rawLodgeQuery),
    [rawLodgeQuery]
  );
  const navLinks = isTenantMode ? tenantNavLinks : marketingNavLinks;

  const withTenantQuery = (href: string) =>
    isTenantMode ? `${href}?lodge=${encodeURIComponent(lodgeSlug)}` : href;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadBranding() {
      try {
        const res = await fetch(`/api/lodges/${lodgeSlug}/site`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const lodge = data.lodge as LodgeBranding | null;
        if (lodge) setBranding(lodge);
      } catch {
        // Keep static fallback branding.
      }
    }
    if (!isTenantMode) return;
    loadBranding();
    return () => {
      active = false;
    };
  }, [isTenantMode, lodgeSlug]);

  const solidHeader = scrolled || !isHome;

  if (!isTenantMode) {
    return (
      <header className="sticky top-0 z-50 border-b border-dash-border bg-dash-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 lg:h-[4.25rem] lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <Image
              src="/brand/lodgepay-sidebar-logo.png"
              alt="LodgePay"
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
            <Link
              href="/admin/login"
              className="rounded-lg bg-dash-ring px-4 py-2.5 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
            >
              Login
            </Link>
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
                <Link
                  href="/admin/login"
                  className="rounded-lg bg-dash-ring py-2.5 text-center text-sm font-semibold text-white"
                  onClick={() => setMobileOpen(false)}
                >
                  Login
                </Link>
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
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border text-[11px] font-semibold tracking-[0.2em] transition-colors",
                  isTenantMode && !solidHeader
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-slate-200 bg-slate-950 text-white"
                )}
              >
                {initialsFromName(branding?.name ?? "Covenant Lodge")}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-semibold tracking-tight transition-colors",
                    isTenantMode && !solidHeader ? "text-white" : "text-slate-950"
                  )}
                >
                  {branding?.name ?? "Covenant Lodge"}
                </p>
                <p
                  className={cn(
                    "text-xs transition-colors",
                    isTenantMode && !solidHeader ? "text-slate-300" : "text-slate-500"
                  )}
                >
                  {`No. 4344 · ${branding?.city ?? "Mayfair, London"}`}
                </p>
              </div>
            </>
          ) : (
            <Image
              src="/brand/lodgepay-sidebar-logo.png"
              alt="LodgePay"
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
              <Link href={withTenantQuery(isTenantMode ? "/join" : "/book-demo")}>
                {isTenantMode ? "Join Us" : "Book a demo"}
              </Link>
            </Button>
            {!isTenantMode ? (
              <Button
                asChild
                size="sm"
                className="bg-dash-ring text-white hover:bg-dash-ring-dark"
              >
                <Link href="/admin/login">Login</Link>
              </Button>
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
                src="/brand/lodgepay-sidebar-logo.png"
                alt="LodgePay"
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
          <div className="mt-3 border-t border-dash-border pt-4">
            <Button asChild className="w-full" variant="primary">
              <Link
                href={withTenantQuery(isTenantMode ? "/join" : "/book-demo")}
                onClick={() => setMobileOpen(false)}
              >
                {isTenantMode ? "Join Us" : "Book a demo"}
              </Link>
            </Button>
            {!isTenantMode ? (
              <Button asChild className="mt-2 w-full bg-dash-ring text-white hover:bg-dash-ring-dark">
                <Link href="/admin/login" onClick={() => setMobileOpen(false)}>
                  Login
                </Link>
              </Button>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}
