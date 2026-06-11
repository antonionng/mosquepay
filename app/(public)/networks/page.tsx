import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  FileSpreadsheet,
  Landmark,
  LayoutDashboard,
  Map,
  Network,
  PoundSterling,
  UserCheck,
  Users,
} from "lucide-react";
import { PLAN_DEFINITIONS } from "@/lib/billing/plans";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "ChurchPay for Networks, Dioceses, Circuits, and Multi-Church Groups",
  description:
    "Roll out giving, Gift Aid, websites, and member records across a diocese, Methodist circuit, Baptist association, Pentecostal network, or multi-site church. Central oversight, per-church autonomy, one invoice.",
  path: "/networks",
  keywords: [
    "diocese church management software",
    "Methodist circuit software",
    "Baptist association church software",
    "Pentecostal network church platform",
    "multi-church management software",
    "church network giving platform",
    "denominational church software UK",
  ],
});

const BUYER_PROFILES = [
  {
    Icon: Landmark,
    title: "Anglican dioceses & deaneries",
    body: "Parish-by-parish records with diocesan-level visibility. Each parish keeps its own website, giving page, and Gift Aid claims; the diocesan office sees the whole picture.",
  },
  {
    Icon: Map,
    title: "Methodist circuits",
    body: "Circuit stewards and superintendents get cross-church reporting and one invoice, while each chapel runs its own services, giving, and membership day to day.",
  },
  {
    Icon: Building2,
    title: "Baptist & independent associations",
    body: "Churches stay independent — their own data, their own bank account, their own branding — and still benefit from a shared rollout, shared pricing, and shared support.",
  },
  {
    Icon: Network,
    title: "Pentecostal networks & multi-site churches",
    body: "Plant a new site with its records, website, and giving links provisioned in bulk. Watch every campus from a single operator console.",
  },
];

const NETWORK_FEATURES = [
  {
    Icon: Users,
    title: "Separate church records",
    body: "Every church in the network is its own tenant: members, giving, Gift Aid, and pastoral data are never pooled. Permissions decide who sees what.",
  },
  {
    Icon: LayoutDashboard,
    title: "Operator console & dashboards",
    body: "Network staff get a console of every church: subscription status, giving activity, and health-style portfolio signals at a glance.",
  },
  {
    Icon: BarChart3,
    title: "Cross-church reporting",
    body: "Compare giving, attendance, and Gift Aid claims across the network without phoning each treasurer for a spreadsheet.",
  },
  {
    Icon: PoundSterling,
    title: "Central billing, one invoice",
    body: "One subscription covering the whole network. Add a church for a per-church increment rather than negotiating each one separately.",
  },
  {
    Icon: FileSpreadsheet,
    title: "Annual returns in one click",
    body: "Network-wide annual returns export as a single CSV — built for the reporting that dioceses, circuits, and associations actually have to file.",
  },
  {
    Icon: UserCheck,
    title: "Migration planning & named contact",
    body: "Network plans include migration planning across all churches and a named contact who knows your structure, not a generic support queue.",
  },
];

const ROLLOUT_STEPS = [
  {
    step: "1",
    title: "Map the network",
    body: "We work with your office to list the churches, agree the order, and plan data migration. Bulk provisioning sets up every church record in one pass.",
  },
  {
    step: "2",
    title: "Roll out in waves",
    body: "Churches go live in groups, each with its own website, giving links, and admin team. Early waves shape the playbook for the rest.",
  },
  {
    step: "3",
    title: "Oversee from the centre",
    body: "Your team watches adoption, giving, and Gift Aid claims from the operator console, with one invoice and one named contact for the whole estate.",
  },
];

const PRICING_TIERS = (["church_group", "network"] as const).map(
  (code) => PLAN_DEFINITIONS[code]
);

export default function NetworksPage() {
  return (
    <MarketingShell>
      {/* Hero */}
      <section className="relative overflow-hidden px-5 pb-16 pt-16 lg:px-8 lg:pb-20 lg:pt-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_75%_10%,rgba(11,67,184,0.08),transparent_70%),radial-gradient(40%_35%_at_15%_85%,rgba(217,180,99,0.12),transparent_70%)]"
        />
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e3dccb] bg-white px-4 py-2 shadow-sm">
              <Network className="h-4 w-4 text-brand" />
              <span className="text-sm font-medium text-slate-600">
                For dioceses, circuits, associations &amp; networks
              </span>
            </div>
            <h1 className="mt-7 font-heading text-[2.6rem] font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              One platform for every church in your care.
              <span className="block text-brand">Without flattening what makes each one different.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              ChurchPay rolls out giving, Gift Aid, websites, and member records across a
              whole network — each church keeps its own identity, data, and bank account,
              while your office gets central oversight, one invoice, and reporting that
              doesn&apos;t depend on chasing treasurers.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_28px_-8px_rgba(11,67,184,0.5)] transition-colors hover:bg-brand-dark"
              >
                Talk to us about your network
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-xl border border-[#ddd5c4] bg-white px-7 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-brand/30 hover:text-brand"
              >
                See Group &amp; Network pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <MarketingSection tinted>
        <div className="max-w-3xl">
          <MarketingKicker>Built for how your denomination works</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Dioceses, circuits, associations, and networks all run differently. ChurchPay
            bends to fit.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Some structures hold authority at the centre, some hold it at the local church.
            ChurchPay separates oversight from control: the network sees the whole estate,
            each church governs its own data and money.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {BUYER_PROFILES.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="rounded-3xl border border-[#e9e2d4] bg-white p-7 shadow-sm"
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

      {/* What the network office gets */}
      <MarketingSection>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>What the network office gets</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Central oversight. Local autonomy. One invoice.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {NETWORK_FEATURES.map(({ Icon, title, body }) => (
            <article
              key={title}
              className="rounded-3xl border border-[#e9e2d4] bg-white p-7 shadow-sm transition-shadow hover:shadow-[0_16px_40px_-16px_rgba(30,41,59,0.18)]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      {/* Rollout */}
      <MarketingSection tinted>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>How a rollout works</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Wave by wave, not big bang.
          </h2>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {ROLLOUT_STEPS.map((item) => (
            <div key={item.step} className="relative rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <span className="font-heading text-5xl font-bold text-brand/15">{item.step}</span>
              <h3 className="mt-4 font-heading text-xl font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      {/* Pricing pointer */}
      <MarketingSection>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>Two ways to buy</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            From a handful of churches to a whole denomination.
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Group covers connected churches with shared oversight. Network adds the operator
            console, network-wide dashboards, and migration support for full rollouts. No
            transaction markup on either.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-2">
          {PRICING_TIERS.map((plan) => (
            <div
              key={plan.code}
              className="flex flex-col rounded-3xl border border-[#e9e2d4] bg-white p-8"
            >
              <h3 className="font-heading text-xl font-semibold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{plan.tag}</p>
              <p className="mt-5 font-heading text-3xl font-bold text-slate-900">{plan.price}</p>
              <p className="mt-1 text-xs text-slate-500">{plan.subPrice}</p>
              <p className="mt-4 text-sm leading-6 text-slate-600">{plan.description}</p>
              <ul className="mt-6 space-y-2.5">
                {plan.featureGroups[0].items.slice(0, 4).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/contact"
                className="mt-8 inline-flex items-center justify-center rounded-xl border border-[#ddd5c4] px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-brand/30 hover:text-brand"
              >
                Talk to us
              </Link>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Planning a rollout across your churches?"
        body="Tell us about your structure — how many churches, how they are governed, and what your office needs to see. We will map a rollout plan, wave by wave, before you commit to anything."
        ctaLabel="Talk to us"
        ctaHref="/contact"
        secondaryLabel="Book a demo"
        secondaryHref="/book-demo"
      />
    </MarketingShell>
  );
}
