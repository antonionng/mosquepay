"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const nav = [
  { href: "/features", label: "Features" },
  { href: "/contact", label: "Contact" },
];

const pillars = [
  {
    k: "01",
    title: "Lodge website the public actually reads",
    body: "Publish officers, meetings, charity work, and news on a site that carries your warrant and your colours. Section-based pages, optional AI drafting to get you started, and content that stays tied to the same lodge your members log into.",
  },
  {
    k: "02",
    title: "Meetings, summons, and the festive board",
    body: "List regular meetings and social nights with RSVPs that separate ceremony and dining, capture guests and dietary needs, and give stewards a head count they can trust. Prepare and send summons, keep a send history, and let brethren open what they need from a secure link or the member portal.",
  },
  {
    k: "03",
    title: "Dues, dining, and the Treasurer's desk",
    body: "Collect event fees and subscriptions online, run dues cycles and reminders, and give your Treasurer a ledger view that matches what hit the bank. Bank import and reconciliation workflows sit beside payment history so month-end is evidence, not archaeology.",
  },
  {
    k: "04",
    title: "Charity campaigns, donations, and Gift Aid",
    body: "Run appeals with clear totals, record donations with stewardship in mind, and capture Gift Aid declarations at the point of giving so your Charity Steward and Treasurer are not rebuilding paperwork when HMRC or the lodge asks.",
  },
  {
    k: "05",
    title: "Member portal, summons, and the digital card",
    body: "Brethren sign in to see meetings, respond where required, pay dues and donations, and keep receipts. Add the lodge card to the phone, subscribe to a private calendar feed, and cut down on paper that never quite reached every member.",
  },
  {
    k: "06",
    title: "Candidates, mentoring, and the Almoner's notebook",
    body: "Move enquiries through a visible pipeline with activities and owners so nothing stalls between interview and ballot. Pair that with welfare cases, visits, and alerts for the Almoner, plus communications templates so the right officer speaks with one voice.",
  },
];

const footerCols = [
  {
    title: "Explore",
    links: [
      { href: "/features", label: "Features" },
      { href: "/book-demo", label: "Book a demo" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/news", label: "News" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/faq", label: "FAQs" },
      { href: "/contact#contact-form", label: "Technical support" },
    ],
  },
];

export function MarketingLanding() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-dash-bg text-dash-text antialiased">
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
            {nav.map((item) => (
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
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>

        {open && (
          <div className="border-t border-dash-border bg-dash-surface px-5 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Mobile">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2.5 text-sm font-medium text-dash-text hover:bg-dash-surface-subtle"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-dash-border pt-4">
                <Link
                  href="/book-demo"
                  className="rounded-lg border border-dash-border px-3 py-2.5 text-center text-sm font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Book a demo
                </Link>
                <Link
                  href="/admin/login"
                  className="rounded-lg bg-dash-ring py-2.5 text-center text-sm font-semibold text-white"
                  onClick={() => setOpen(false)}
                >
                  Login
                </Link>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main>
        {/* Hero */}
        <section className="border-b border-dash-border bg-dash-surface">
          <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">
                For Craft lodges
              </p>
              <h1 className="mt-4 max-w-[22rem] font-heading text-[2.35rem] font-semibold leading-[1.08] tracking-tight text-dash-text text-balance sm:max-w-2xl sm:text-5xl sm:leading-[1.06] lg:text-[3.35rem]">
                Your summons, your books, and your candidates finally match.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-normal leading-relaxed text-dash-muted text-pretty sm:text-[17px]">
                Lodges use LodgePay to run the lodge website and member portal, online dues and donations with Gift Aid,
                meetings and summons, treasurer reconciliation to the bank, charity, Almoner welfare, and candidates to
                the ballot, in one system with officer roles.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href="/book-demo"
                  className="inline-flex items-center justify-center rounded-lg bg-dash-ring px-6 py-3 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
                >
                  Book a demo
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center justify-center rounded-lg border border-dash-border-strong bg-dash-surface px-6 py-3 text-sm font-semibold text-dash-text shadow-sm transition-colors hover:bg-dash-surface-subtle"
                >
                  See what is included
                </Link>
              </div>
            </div>
            <div className="relative aspect-[4/5] w-full max-lg:max-w-md overflow-hidden border border-dash-border bg-dash-surface-subtle shadow-dash">
              <Image
                src="/marketing/hero-brethren.png"
                alt="Brethren in lodge temple after meeting, formal suits and white gloves"
                fill
                className="object-cover object-[center_20%]"
                sizes="(max-width: 1024px) 100vw, 42vw"
                priority
              />
            </div>
          </div>
        </section>

        {/* Narrative strip */}
        <section className="border-b border-dash-border bg-dash-bg">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight text-dash-text text-balance sm:text-3xl">
                  When the lists disagree, the lodge pays the price. LodgePay removes the guesswork.
                </h2>
              </div>
              <div className="space-y-5 text-base leading-relaxed text-dash-muted">
                <p>
                  One record for meetings, hospitality, dues, charity, and membership. Officers stop maintaining
                  parallel spreadsheets the week before a meeting.
                </p>
                <p>
                  Role-based access for Secretary, Treasurer, Charity Steward, Membership, Almoner, and Mentor.
                  Secretary, treasurer, charity, and recruitment reports plus an audit trail for sensitive work. Provinces
                  keep portfolio oversight without merging every lodge into one template.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pillars */}
        <section className="border-b border-dash-border bg-dash-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">What you get</p>
              <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-dash-text text-balance sm:text-3xl">
                Tyler to Treasurer to Charity Steward: one platform, every officer on the same facts.
              </h2>
            </div>
            <ul className="mt-14 divide-y divide-dash-border border-t border-dash-border">
              {pillars.map((row) => (
                <li key={row.k} className="grid gap-6 py-10 lg:grid-cols-[5rem_minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-10">
                  <span className="font-heading text-sm font-semibold tabular-nums text-dash-faint">{row.k}</span>
                  <h3 className="font-heading text-lg font-semibold text-dash-text lg:pt-0.5">{row.title}</h3>
                  <p className="text-base leading-relaxed text-dash-muted lg:pt-0.5">{row.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Stewardship + imagery */}
        <section className="border-b border-dash-border bg-dash-bg">
          <div className="mx-auto grid max-w-6xl gap-0 lg:grid-cols-[1fr_2fr]">
            <div className="flex flex-col justify-between border-dash-border bg-dash-surface-subtle p-8 lg:border-r lg:p-12">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Stewardship</p>
                <h2 className="mt-4 font-heading text-xl font-semibold tracking-tight text-dash-text sm:text-2xl">
                  Built for the officers who hold the lodge on their shoulders between meetings.
                </h2>
              </div>
              <ul className="mt-10 space-y-3 text-sm leading-relaxed text-dash-muted">
                <li className="border-l-2 border-dash-ring pl-4">
                  Communications and template library so summons, reminders, and lodge notices stay consistent.
                </li>
                <li className="border-l-2 border-dash-border pl-4">
                  Mentoring tools alongside the candidate pipeline so proposers and sponsors stay engaged.
                </li>
                <li className="border-l-2 border-dash-border pl-4">
                  AI assistant where you want it: drafting copy and answering lodge questions without replacing the
                  Master&apos;s gavel.
                </li>
              </ul>
              <p className="mt-10 max-w-sm text-sm leading-relaxed text-dash-muted">
                Your lodge photography belongs here: festive board, installation, or the Temple. Swap this panel for
                imagery that reflects your own brethren and building.
              </p>
            </div>
            <div className="relative aspect-[16/10] min-h-[240px] w-full overflow-hidden border-0 border-t border-dash-border bg-dash-surface-subtle lg:min-h-[320px] lg:border-l lg:border-t-0">
              <Image
                src="/marketing/landing-stewardship.png"
                alt="Worshipful Master and officer in lodge Temple, regalia and formal portrait"
                fill
                className="object-cover object-[center_25%]"
                sizes="(max-width: 1024px) 100vw, 65vw"
              />
            </div>
          </div>
        </section>

        {/* Three outcomes */}
        <section className="border-b border-dash-border bg-dash-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-24">
            <h2 className="max-w-2xl font-heading text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">
              Why lodges choose LodgePay over another website tool or spreadsheet
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              <div className="border-l-2 border-dash-ring pl-6">
                <p className="font-heading text-base font-semibold text-dash-text">One record the whole lodge trusts</p>
                <p className="mt-3 text-sm leading-relaxed text-dash-muted">
                  Meetings, summons, RSVPs, communications, and reports draw from the same data. The Secretary and
                  Director of Ceremonies are not maintaining parallel lists the week before a meeting.
                </p>
              </div>
              <div className="border-l-2 border-dash-border pl-6">
                <p className="font-heading text-base font-semibold text-dash-text">Accounts the Treasurer can stand on</p>
                <p className="mt-3 text-sm leading-relaxed text-dash-muted">
                  Dues, dining, donations, and charity appeals flow into ledgers and reconciliation the Treasurer can
                  show the auditor or the charity committee. Payment status stays visible from checkout to bank, without
                  jargon on the public page.
                </p>
              </div>
              <div className="border-l-2 border-dash-border pl-6">
                <p className="font-heading text-base font-semibold text-dash-text">Brethren served between meetings</p>
                <p className="mt-3 text-sm leading-relaxed text-dash-muted">
                  The member portal, installable app experience, digital lodge card, private calendar feed, receipts, and
                  online dues keep younger and travelling members inside the tent instead of chasing paper.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quote block */}
        <section className="border-b border-dash-border bg-dash-bg">
          <div className="mx-auto max-w-6xl px-5 py-16 lg:px-8 lg:py-20">
            <blockquote className="mx-auto max-w-3xl border border-dash-border bg-dash-surface p-8 shadow-dash sm:p-12">
              <p className="font-heading text-xl font-medium leading-snug text-dash-text sm:text-2xl">
                &ldquo;A lodge is not a website. It is men meeting on the level. LodgePay exists so the labour around
                that meeting, the charity after it, and the care between meetings does not exhaust the brethren who
                already give their time without fee or reward.&rdquo;
              </p>
              <footer className="mt-8 text-sm text-dash-muted">
                <span className="font-medium text-dash-text">LodgePay</span>
                <span className="text-dash-faint"> · principles we build toward</span>
              </footer>
            </blockquote>
          </div>
        </section>

        {/* Second human placeholder row */}
        <section className="border-b border-dash-border bg-dash-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-8 lg:py-20">
            <div className="relative order-2 aspect-[4/5] w-full overflow-hidden border border-dash-border bg-dash-surface-subtle shadow-dash lg:order-1">
              <Image
                src="/marketing/landing-provinces.png"
                alt="Lodge officers reviewing ledger and accounts at the table, formal collaboration"
                fill
                className="object-cover object-center"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">Provinces and groups</p>
              <h2 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">
                One platform for the Province. Each lodge still its own home.
              </h2>
              <p className="mt-6 text-base leading-relaxed text-dash-muted">
                Roll LodgePay out across a Province, District, or Masonic hall group with per-lodge sites, books, and
                members, while central staff retain billing, support, integrations, and portfolio reporting. Platform
                overview and province-level views help you see which lodges need help before a summons goes wrong or
                dues fall behind.
              </p>
              <Link
                href="/contact"
                className="mt-8 inline-block text-sm font-semibold text-dash-ring underline-offset-4 hover:underline"
              >
                Speak to us about a Province-wide rollout
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-dash-ring-dark text-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-14 lg:flex-row lg:items-center lg:px-8 lg:py-16">
            <div className="max-w-xl">
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Walk through LodgePay with your lodge name on the screen.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-white/80">
                In one session we show the website, meetings and summons, dues and Treasurer tools, charity and Gift
                Aid, the member portal, candidate pipeline, welfare, communications, and the reports your Secretary and
                Treasurer already owe the lodge.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto">
              <Link
                href="/book-demo"
                className="inline-flex min-h-[2.75rem] min-w-[10rem] items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-dash-ring-dark shadow-sm transition-opacity hover:opacity-95"
              >
                Book a demo
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-[2.75rem] items-center justify-center rounded-lg border border-white/35 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-dash-border bg-dash-surface">
        <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8 lg:py-16">
          <div className="flex flex-col gap-10 border-b border-dash-border pb-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xs">
              <Image
                src="/brand/lodgepay-sidebar-logo.png"
                alt="LodgePay"
                width={1032}
                height={245}
                className="h-9 w-auto max-w-[10rem] object-contain opacity-90"
              />
              <p className="mt-4 text-sm leading-relaxed text-dash-muted">
                Websites, meetings, summons, dues, charity, Gift Aid, member portal, digital card, candidate CRM,
                mentoring, Almoner, communications, Treasurer reconciliation, and audit-ready reporting for Masonic
                lodges.
              </p>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-10 sm:grid-cols-3 lg:max-w-2xl lg:justify-end">
              {footerCols.map((col) => (
                <div key={col.title}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dash-faint">{col.title}</p>
                  <ul className="mt-4 space-y-2">
                    {col.links.map((l) => (
                      <li key={l.href + l.label}>
                        <Link href={l.href} className="text-sm text-dash-muted transition-colors hover:text-dash-text">
                          {l.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-4 pt-8 text-sm text-dash-faint sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; {new Date().getFullYear()} LodgePay. All rights reserved.</p>
            <div className="flex flex-wrap gap-6">
              <Link href="/privacy" className="hover:text-dash-muted">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-dash-muted">
                Terms
              </Link>
              <Link href="/gdpr" className="hover:text-dash-muted">
                GDPR
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
