"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/networks", label: "Networks" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/networks", label: "For networks & networks" },
      { href: "/pricing", label: "Pricing" },
      { href: "/book-demo", label: "Book a demo" },
      { href: "/news", label: "Product news" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About MosquePay" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
      { href: "/join", label: "Get started" },
    ],
  },
  {
    title: "For your mosque",
    links: [
      { href: "/member/login", label: "Member portal" },
      { href: "/admin/login", label: "Admin dashboard" },
      { href: "/book-demo", label: "Talk to our team" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/gdpr", label: "GDPR" },
      { href: "/cookies", label: "Cookie policy" },
    ],
  },
];

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[#faf8f3] text-slate-900 antialiased">
      <header className="sticky top-0 z-50 border-b border-[#e9e2d4] bg-[#faf8f3]/90 backdrop-blur-md">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-6 px-5 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="MosquePay home">
            <Image
              src="/brand/mosquepay-sidebar-logo.png"
              alt="MosquePay"
              width={1032}
              height={245}
              className="h-9 w-auto max-w-[11rem] object-contain lg:h-10"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            {NAV_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition-colors hover:text-brand ${
                  pathname === item.href ? "text-brand" : "text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/book-demo"
              className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(11,67,184,0.45)] transition-colors hover:bg-brand-dark"
            >
              Book a demo
            </Link>
          </div>

          <button
            type="button"
            className="rounded-xl border border-[#ddd5c4] bg-white p-2 text-slate-700 md:hidden"
            aria-expanded={open}
            aria-label="Toggle menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {open && (
          <div className="border-t border-[#e9e2d4] bg-[#faf8f3] px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-white"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#e9e2d4] pt-4">
                <Link
                  href="/book-demo"
                  className="rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  Book a demo
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#e9e2d4] bg-[#f4f0e7]">
        <div className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
            <div className="max-w-xs">
              <Image
                src="/brand/mosquepay-sidebar-logo.png"
                alt="MosquePay"
                width={1032}
                height={245}
                className="h-9 w-auto max-w-[10rem] object-contain"
              />
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Donations, Zakat &amp; Sadaqah, Gift Aid, Jumu&apos;ah, congregation
                records, and welfare for UK mosques, in one calm, joined-up platform.
              </p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-brand/70">
                Smart Payments. Stronger Communities.
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-4 lg:max-w-3xl">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {col.title}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.href + link.label}>
                        <Link
                          href={link.href}
                          className="text-sm text-slate-600 transition-colors hover:text-brand"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-3 border-t border-[#e3dccb] pt-7 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} MosquePay. All rights reserved.</p>
            <p>Made for UK mosques, charities, and networks.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** Shared section primitives for marketing pages. */
export function MarketingSection({
  children,
  tinted = false,
  className = "",
}: {
  children: ReactNode;
  tinted?: boolean;
  className?: string;
}) {
  return (
    <section className={`${tinted ? "bg-[#f4f0e7]" : ""} px-5 py-16 lg:px-8 lg:py-24 ${className}`}>
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function MarketingKicker({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand">{children}</p>
  );
}

export function MarketingCtaBand({
  title,
  body,
  ctaLabel = "Book a demo",
  ctaHref = "/book-demo",
  secondaryLabel,
  secondaryHref,
}: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="px-5 pb-20 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-dark via-brand to-[#1d5fd6] px-8 py-14 text-white shadow-[0_30px_60px_-20px_rgba(11,67,184,0.5)] lg:px-14">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-base leading-7 text-blue-100">{body}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href={ctaHref}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 py-3 text-sm font-semibold text-brand-dark shadow-sm transition-opacity hover:opacity-95"
            >
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {secondaryLabel && secondaryHref && (
              <Link
                href={secondaryHref}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/35 px-7 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
