import Image from "next/image";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Globe,
  HeartHandshake,
  Mail,
  PoundSterling,
  Sparkles,
  Users,
} from "lucide-react";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Church Management Features | ChurchPay",
  description:
    "Explore ChurchPay features for churches and networks: online giving, Gift Aid and GASDS, church websites, member portals, service notices, event RSVPs, newcomer CRM, pastoral care, and treasurer reporting.",
  path: "/features",
  keywords: [
    "church management features",
    "church giving software",
    "church member portal",
    "service notice software",
    "newcomer management",
  ],
});

const MODULES = [
  {
    Icon: PoundSterling,
    kicker: "Giving & Gift Aid",
    title: "Every gift counted. Every penny of Gift Aid claimed.",
    body: "Collect planned giving, one-off donations, service collections, and event payments online, by QR code, or recorded as cash. Gift Aid declarations are captured at the point of giving and GASDS cash evidence is logged per service, so claims are ready when HMRC asks.",
    points: [
      "Online, QR, card, and recorded cash giving",
      "Gift Aid declarations attached to every eligible gift",
      "GASDS service collection tracking",
      "HMRC-ready claim exports and evidence packs",
    ],
    image: "/marketing/placeholder-giving.png",
  },
  {
    Icon: Users,
    kicker: "Congregation CRM",
    title: "Your whole congregation, one trustworthy record.",
    body: "Members, families, guests, and newcomers live in one database with consent, contact preferences, giving history, and attendance. Role-based permissions mean safeguarding leads, treasurers, and welcome teams each see exactly what they should.",
    points: [
      "Member and guest records with full history",
      "Consent and GDPR-friendly communication preferences",
      "Role-based access for sensitive information",
      "Bulk import from your existing spreadsheets",
    ],
    image: "/marketing/placeholder-church-dashboard.png",
  },
  {
    Icon: CalendarDays,
    kicker: "Services & events",
    title: "From Sunday services to special events, organised.",
    body: "Plan your service calendar, send service notices by email with secure member links, take RSVPs with hospitality and dietary tracking, and collect event payments. All from one workflow your admin team will actually enjoy.",
    points: [
      "Service planning with repeating sequences",
      "Service notices with send history",
      "RSVPs, hospitality lists, and dietary needs",
      "Event tickets and payment collection",
    ],
    image: "/marketing/placeholder-church-dashboard.png",
  },
  {
    Icon: Sparkles,
    kicker: "Newcomer journey",
    title: "A welcome that never loses anyone between Sundays.",
    body: "Every enquiry and first-time visit gets an owner and a next step. Move people through visit, follow-up, membership class, and welcome with a visible pipeline, so your welcome team always knows who needs a call.",
    points: [
      "Newcomer pipeline with owners and next actions",
      "Public newcomer forms on your church website",
      "Guest invitations with secure links",
      "Conversion to full member records in one click",
    ],
    image: "/marketing/placeholder-newcomers.png",
  },
  {
    Icon: HeartHandshake,
    kicker: "Pastoral care",
    title: "Care for your people, with privacy built in.",
    body: "Track pastoral cases, visits, bereavements, and follow-ups in a module only your pastoral team can see. Gentle signals like missed services and lapsed giving help you reach out before someone drifts away.",
    points: [
      "Confidential care cases and visit logs",
      "Care alerts from attendance and giving signals",
      "Bereavement and hospital visit tracking",
      "Strict role-based visibility",
    ],
    image: "/marketing/placeholder-pastoral.png",
  },
  {
    Icon: Globe,
    kicker: "Church website",
    title: "A beautiful public site, without another login.",
    body: "Publish service times, events, giving pages, news, and newcomer forms on a fast, branded website managed from the same admin. AI-assisted drafting helps you get started; section-based editing keeps it easy to maintain.",
    points: [
      "Section-based visual editor with AI drafts",
      "Service times, events, and online giving pages",
      "News and announcement publishing",
      "Custom domain and your church branding",
    ],
    image: "/marketing/placeholder-church-dashboard.png",
  },
  {
    Icon: BarChart3,
    kicker: "Treasurer reporting",
    title: "Month-end in minutes, not weekends.",
    body: "Bank statement import and reconciliation sit beside payment history, so what hit the bank matches what the system says. Giving statements, ledgers, and audit trails give your treasurer and auditors confidence.",
    points: [
      "Bank import and reconciliation workflows",
      "Giving statements and annual summaries",
      "Ledger views matched to payment history",
      "Full audit trail for sensitive operations",
    ],
    image: "/marketing/placeholder-giving.png",
  },
  {
    Icon: Building2,
    kicker: "Networks & multi-church",
    title: "Many churches, one platform, local identity intact.",
    body: "Run a group, circuit, or network with per-church sites, records, and branding while central teams keep billing, reporting, and rollout support in one console. See which churches need help before problems grow.",
    points: [
      "Per-church branding, data, and websites",
      "Cross-church reporting and dashboards",
      "Central billing on one invoice",
      "Network rollout and migration support",
    ],
    image: "/marketing/placeholder-network.png",
  },
];

const EXTRAS = [
  {
    Icon: Mail,
    title: "Communications",
    body: "Email templates, reminders, and newsletters that pull names and details from the same member records.",
  },
  {
    Icon: Sparkles,
    title: "AI assistant",
    body: "Draft notices, website copy, and follow-up messages with AI that understands church context.",
  },
  {
    Icon: Check,
    title: "Audit & compliance",
    body: "Audit logs, consent records, SAR support, and data retention controls for good governance.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <MarketingKicker>Features</MarketingKicker>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Built around real church life, not generic admin.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Every module, from giving and people to services, care, website, and reporting,
              works from the same congregation record, so your team finally shares one version of
              the truth.
            </p>
          </div>
        </div>
      </section>

      {MODULES.map((mod, index) => (
        <MarketingSection key={mod.kicker} tinted={index % 2 === 1}>
          <div
            className={`grid items-center gap-12 lg:grid-cols-2 ${
              index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <mod.Icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.24em] text-brand">
                {mod.kicker}
              </p>
              <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {mod.title}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">{mod.body}</p>
              <ul className="mt-6 space-y-2.5">
                {mod.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            <div className="overflow-hidden rounded-[1.75rem] border border-[#e3dccb] bg-white p-2.5 shadow-[0_20px_50px_-20px_rgba(30,41,59,0.2)]">
              <Image
                src={mod.image}
                alt={`${mod.kicker} preview`}
                width={1600}
                height={1000}
                className="aspect-[16/10] w-full rounded-[1.25rem] object-cover"
              />
            </div>
          </div>
        </MarketingSection>
      ))}

      <MarketingSection>
        <div className="mx-auto max-w-2xl text-center">
          <MarketingKicker>And more</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900">
            The details are covered too.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {EXTRAS.map(({ Icon, title, body }) => (
            <article key={title} className="rounded-3xl border border-[#e9e2d4] bg-white p-7">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/8 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="See every feature live, with your data."
        body="Book a walkthrough and we'll demo the modules that matter most to your church. Giving and Gift Aid first, if you like."
        secondaryLabel="See pricing"
        secondaryHref="/pricing"
      />
    </MarketingShell>
  );
}
