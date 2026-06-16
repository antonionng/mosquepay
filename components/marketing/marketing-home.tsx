import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Check,
  Landmark,
  Globe,
  HandHeart,
  HeartHandshake,
  PoundSterling,
  QrCode,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { TerminalShowcase } from "@/components/marketing/terminal-showcase";
import { HeroDashboard } from "@/components/marketing/hero-dashboard";
import {
  GivingClaimMock,
  NewcomerPipelineMock,
} from "@/components/marketing/feature-mini-mocks";

const PILLARS = [
  {
    Icon: PoundSterling,
    title: "Giving & Gift Aid",
    body: "Online giving, one-off donations, service collections, and event payments, with Gift Aid declarations and GASDS evidence captured at the moment of giving.",
  },
  {
    Icon: Users,
    title: "Congregation CRM",
    body: "Members, families, guests, and newcomers in one place, with consent, communication history, and role-based access for your team.",
  },
  {
    Icon: CalendarDays,
    title: "Services & events",
    body: "Plan Friday Jumu'ah, midweek groups, and special events. Send service notices, take RSVPs, and track hospitality without chasing paper.",
  },
  {
    Icon: HeartHandshake,
    title: "Welfare",
    body: "Care cases, visit logs, and gentle follow-up prompts so nobody slips through the cracks. Visible only to the people who should see them.",
  },
  {
    Icon: Globe,
    title: "Mosque website",
    body: "A simple public site with service times, events, giving pages, news, and newcomer forms, published from the same admin you already use.",
  },
  {
    Icon: BarChart3,
    title: "Treasurer reporting",
    body: "Bank import, reconciliation, giving statements, and HMRC-ready Gift Aid claims. Evidence, not archaeology, at year end.",
  },
];

const CHARITY_POINTS = [
  {
    Icon: Target,
    title: "Campaigns with targets",
    body: "Run a building fund appeal, a mission appeal, or a Christmas collection as a named campaign with its own target and progress. Every gift is recorded against the right appeal.",
  },
  {
    Icon: QrCode,
    title: "A giving link for every appeal",
    body: "Each campaign gets its own QR code and giving page. Put it on the screen, the notice sheet, or the pew card and gifts arrive already labelled.",
  },
  {
    Icon: HandHeart,
    title: "Gift Aid on charity gifts too",
    body: "Declarations are captured at the moment of giving, and GASDS evidence is logged for cash collections, so charitable appeals claim the same 25% as regular giving.",
  },
  {
    Icon: BarChart3,
    title: "Reporting your PCC will trust",
    body: "Donations report by campaign, so your treasurer can show exactly what came in for each appeal and what it was given for. No more untangling a single giving total.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Get set up in days",
    body: "A guided setup wizard walks you through importing members and giving records, branding your site, and connecting payments. Our team is on hand whenever you want help.",
  },
  {
    step: "2",
    title: "Your congregation gives & connects",
    body: "Members give online or by QR code, RSVP to services, update their details, and see their giving history in the portal.",
  },
  {
    step: "3",
    title: "Your team sees one clear picture",
    body: "Treasurers reconcile in minutes, imams see who needs care, and Gift Aid claims are ready when HMRC asks.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Our giving records, Gift Aid declarations, and bank statements finally agree with each other. Claim season went from weeks to an afternoon.",
    name: "Sarah Whitfield",
    role: "Mosque Treasurer",
    initials: "SW",
  },
  {
    quote:
      "Newcomers used to slip through between Sundays. Now every visit is logged and every follow-up is prompted. Our welcome team loves it.",
    name: "Robert Clarke",
    role: "Lead Imam",
    initials: "RC",
  },
  {
    quote:
      "Service notices, RSVPs, and the mosque website all come from the same place. I stopped maintaining three different lists.",
    name: "David Patterson",
    role: "Mosque Administrator",
    initials: "DP",
  },
];

const PRICING_TEASER = (["mosque_essentials", "mosque_complete", "mosque_group"] as const).map(
  (code) => PLAN_DEFINITIONS[code]
);

export function MarketingHome() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-16 pt-16 lg:px-8 lg:pb-24 lg:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_75%_10%,rgba(11,67,184,0.08),transparent_70%),radial-gradient(40%_35%_at_15%_85%,rgba(217,180,99,0.12),transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.88fr)] lg:gap-12">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e3dccb] bg-white px-4 py-2 shadow-sm">
              <Landmark className="h-4 w-4 text-brand" />
              <span className="text-sm font-medium text-slate-600">
                Built for UK mosques, charities &amp; networks
              </span>
            </div>
            <h1 className="mt-7 max-w-2xl font-heading text-[2.6rem] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.4rem]">
              Giving, Gift Aid, and your whole congregation.{" "}
              <span className="text-brand">All in one place.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              MosquePay brings together online giving, Gift Aid &amp; GASDS, member records,
              service notices, newcomer follow-up, welfare, and treasurer reporting, so
              your team spends Sunday with people, not spreadsheets.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/book-demo"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(11,67,184,0.5)] transition-colors hover:bg-brand-dark"
              >
                Book a mosque demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/features"
                className="inline-flex items-center rounded-xl border border-[#ddd5c4] bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-brand/30 hover:text-brand"
              >
                Explore features
              </Link>
            </div>
          </div>
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_60%_40%,rgba(11,67,184,0.14),transparent_70%)] blur-2xl"
            />
            <HeroDashboard />
          </div>
        </div>
      </section>

      {/* Worship — why it matters */}
      <MarketingSection>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-5 -z-10 rounded-[2.5rem] bg-[radial-gradient(60%_60%_at_40%_50%,rgba(217,180,99,0.18),transparent_70%)] blur-2xl"
            />
            <div className="overflow-hidden rounded-[2rem] border border-[#e9e2d4] shadow-[0_24px_60px_-24px_rgba(30,41,59,0.3)]">
              <Image
                src="/marketing/placeholder-worship.png"
                alt="A congregation worshipping together on a Sunday morning, hands raised in a warmly lit mosque"
                width={1600}
                height={1100}
                className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
              />
            </div>
            <div className="absolute -bottom-5 left-5 right-5 sm:left-auto sm:right-8 sm:w-[19rem]">
              <div className="rounded-2xl border border-[#e9e2d4] bg-white/95 p-4 shadow-[0_16px_40px_-16px_rgba(30,41,59,0.3)] backdrop-blur">
                <p className="text-sm font-medium leading-6 text-slate-700">
                  &ldquo;Our welcome team used to spend Sunday behind a counting table. Now
                  they&rsquo;re in the room with everyone else.&rdquo;
                </p>
                <p className="mt-2 text-xs font-semibold text-brand">
                  A mosque on MosquePay
                </p>
              </div>
            </div>
          </div>
          <div>
            <MarketingKicker>Why we built MosquePay</MarketingKicker>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Your team should be worshipping, not reconciling.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Every hour your volunteers spend counting cash, chasing Gift Aid forms, or
              copying names between spreadsheets is an hour they are not with the
              congregation. MosquePay quietly handles the admin in the background, so Sunday
              feels like Sunday again.
            </p>
            <ul className="mt-7 space-y-3.5">
              {[
                "Collections counted, logged, and Gift Aid-tagged before Monday morning",
                "Newcomer follow-ups prompted automatically, not scribbled on paper lists",
                "Treasurer reports that assemble themselves while you are in the service",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10">
                    <Check className="h-3 w-3 text-brand" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href="/about"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
            >
              Read why mosques switch
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </MarketingSection>

      {/* Pillars */}
      <MarketingSection tinted>
        <div className="max-w-3xl">
          <MarketingKicker>Everything your mosque needs</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            One shared record for treasurers, imams, and welcome teams.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Stop reconciling parallel spreadsheets. Every module reads and writes the same
            congregation record, with permissions that keep sensitive data in the right hands.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="group rounded-3xl border border-[#e9e2d4] bg-white p-7 shadow-sm transition-shadow hover:shadow-[0_16px_40px_-16px_rgba(30,41,59,0.18)]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      {/* In-person giving terminal */}
      <TerminalShowcase />

      {/* Charity & designated giving */}
      <MarketingSection>
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <MarketingKicker>Charity &amp; designated giving</MarketingKicker>
            <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Building fund, mission appeal, Christmas collection. Each gift lands where it was
              meant to.
            </h2>
            <p className="mt-5 text-base leading-7 text-slate-600">
              Most mosques run more than one pot: the general fund, a building appeal, a
              mission partner, a seasonal collection. MosquePay lets you run each one as a
              named campaign with its own giving link, so designated gifts stay designated
              from the moment of giving through to the treasurer&apos;s report.
            </p>
            <Link
              href="/charity"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-brand-dark"
            >
              See how charity giving works
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {CHARITY_POINTS.map(({ Icon, title, body }) => (
              <article
                key={title}
                className="rounded-3xl border border-[#e9e2d4] bg-white p-7 shadow-sm"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-heading text-base font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm leading-6 text-slate-600">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </MarketingSection>

      {/* How it works */}
      <MarketingSection tinted>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>How it works</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Up and running in days, not months.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="relative rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <span className="font-heading text-5xl font-bold text-brand/15">{item.step}</span>
              <h3 className="mt-4 font-heading text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-3xl border border-[#e9e2d4] bg-white">
            <GivingClaimMock />
            <div className="flex items-start gap-3 border-t border-[#efe9dc] p-6">
              <HandHeart className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <h3 className="font-heading text-base font-semibold text-slate-900">
                  Giving that claims itself
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Gift Aid declarations attach to gifts automatically. GASDS cash collections are
                  logged per service. Claims export ready for HMRC.
                </p>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-[#e9e2d4] bg-white">
            <NewcomerPipelineMock />
            <div className="flex items-start gap-3 border-t border-[#efe9dc] p-6">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <h3 className="font-heading text-base font-semibold text-slate-900">
                  A welcome that never drops anyone
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  From first visit to membership class, every newcomer has an owner, a next step,
                  and a story your welcome team can see.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MarketingSection>

      {/* Testimonials */}
      <MarketingSection>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>Loved by mosque teams</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            What mosques say after switching.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure key={t.name} className="flex flex-col justify-between rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <blockquote className="text-base leading-7 text-slate-700">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 font-heading text-sm font-bold text-brand">
                  {t.initials}
                </span>
                <span>
                  <span className="block font-heading text-sm font-semibold text-slate-900">{t.name}</span>
                  <span className="block text-sm text-slate-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </MarketingSection>

      {/* Pricing teaser */}
      <MarketingSection tinted>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>Simple pricing</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Plans that grow with your mosque.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            From a single congregation to a multi-mosque network. No setup fees, no surprises.
          </p>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {PRICING_TEASER.map((plan) => (
            <div
              key={plan.code}
              className={`flex flex-col rounded-3xl border bg-white p-8 ${
                plan.recommended
                  ? "border-brand shadow-[0_20px_50px_-18px_rgba(11,67,184,0.35)]"
                  : "border-[#e9e2d4]"
              }`}
            >
              {plan.recommended && (
                <span className="mb-4 inline-flex w-fit rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                  Most popular
                </span>
              )}
              <h3 className="font-heading text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.tag}</p>
              <p className="mt-5 font-heading text-3xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-1 text-xs text-slate-500">{plan.subPrice}</p>
              <ul className="mt-6 space-y-2.5">
                {plan.featureGroups[0].items.slice(0, 3).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/pricing"
                className={`mt-8 inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-colors ${
                  plan.recommended
                    ? "bg-brand text-white hover:bg-brand-dark"
                    : "border border-[#ddd5c4] text-slate-800 hover:border-brand/30 hover:text-brand"
                }`}
              >
                See full pricing
              </Link>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* Networks teaser */}
      <MarketingSection>
        <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-[#e9e2d4] bg-white p-8 shadow-sm lg:flex-row lg:items-center lg:p-12">
          <div className="max-w-2xl">
            <MarketingKicker>For networks &amp; denominations</MarketingKicker>
            <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Overseeing a network, circuit, association, or network of mosques?
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Roll MosquePay out across every mosque in your care, with central oversight,
              cross-mosque reporting, one invoice, and each mosque keeping its own identity
              and bank account.
            </p>
          </div>
          <Link
            href="/networks"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(11,67,184,0.5)] transition-colors hover:bg-brand-dark"
          >
            MosquePay for networks
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="See MosquePay with your mosque's name on the screen."
        body="A 30-minute walkthrough of giving, Gift Aid, congregation records, services, newcomers, welfare, and treasurer reporting, tailored to how your mosque works."
        secondaryLabel="Talk to us first"
        secondaryHref="/contact"
      />
    </MarketingShell>
  );
}
