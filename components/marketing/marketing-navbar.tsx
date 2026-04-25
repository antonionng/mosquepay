"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { href: "/features", label: "Features" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function MarketingNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-mkt-border bg-mkt-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1204px] items-center justify-between px-6 py-5">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="font-heading text-2xl font-bold text-white">
            LodgePay
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-mkt-blue">
            <path d="M8 1l2.2 4.4L15 6.3l-3.5 3.4.8 4.9L8 12.4 3.7 14.6l.8-4.9L1 6.3l4.8-.9L8 1z" fill="currentColor" />
          </svg>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-heading text-[15px] font-medium text-mkt-text-secondary transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/book-demo"
            className="rounded-lg border border-mkt-blue bg-transparent px-5 py-2.5 font-heading text-sm font-bold text-mkt-blue transition-colors hover:bg-mkt-blue/10"
          >
            Get a Demo
          </Link>
          <Link
            href="/book-demo"
            className="rounded-lg bg-mkt-blue px-5 py-2.5 font-heading text-sm font-bold text-white transition-colors hover:bg-mkt-blue-light"
          >
            Start Free Trial
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-white md:hidden"
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-mkt-border bg-mkt-bg px-6 pb-6 pt-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="font-heading text-base font-medium text-mkt-text-secondary transition-colors hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/book-demo"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-mkt-blue bg-transparent px-5 py-2.5 text-center font-heading text-sm font-bold text-mkt-blue transition-colors hover:bg-mkt-blue/10"
            >
              Get a Demo
            </Link>
            <Link
              href="/book-demo"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-mkt-blue px-5 py-2.5 text-center font-heading text-sm font-bold text-white transition-colors hover:bg-mkt-blue-light"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
