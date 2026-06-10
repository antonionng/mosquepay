import { HandHeart, ShieldCheck, Sparkles, Users } from "lucide-react";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
  MarketingCtaBand,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "About ChurchPay | Software Built for UK Church Teams",
  description:
    "ChurchPay exists so church teams spend less time on spreadsheets and more time with people. Learn why we built one platform for giving, Gift Aid, congregation records, services, and pastoral care.",
  path: "/about",
  keywords: [
    "about ChurchPay",
    "church software company",
    "UK church technology",
    "church administration platform",
  ],
});

const VALUES = [
  {
    Icon: Users,
    title: "People before process",
    description:
      "Software should free up volunteers and staff for ministry, not create new admin. Every feature starts with the question: does this give time back?",
  },
  {
    Icon: ShieldCheck,
    title: "Stewardship and trust",
    description:
      "Churches handle money and sensitive pastoral information. We build with role-based access, audit trails, and UK data protection in mind from day one.",
  },
  {
    Icon: HandHeart,
    title: "Generosity made easy",
    description:
      "Giving should be simple for the giver and accountable for the church. Gift Aid and GASDS shouldn't require a specialist to claim correctly.",
  },
  {
    Icon: Sparkles,
    title: "Calm, joined-up tools",
    description:
      "One record, one login, one version of the truth. No more exporting from one tool to paste into another.",
  },
];

const STORY = [
  {
    title: "The problem we kept seeing",
    body: "Church treasurers reconciling three spreadsheets at midnight. Welcome teams losing newcomers between Sundays. Gift Aid claims left unclaimed because the paperwork was scattered. Churches were running on goodwill and copy-paste.",
  },
  {
    title: "Why we built ChurchPay",
    body: "We believed UK churches deserved software designed around how they actually work: Sunday services, planned giving, Gift Aid and GASDS, pastoral confidentiality, and volunteers who change every year. Not a generic CRM with a cross on the logo.",
  },
  {
    title: "Where we are today",
    body: "ChurchPay covers giving, congregation records, services and notices, newcomer follow-up, pastoral care, church websites, and treasurer reporting. It works for single churches, multi-site groups, and whole networks.",
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <MarketingKicker>About ChurchPay</MarketingKicker>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              We build software so church teams can get back to people.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              ChurchPay started with a simple conviction: the administrative weight of running a
              church, from giving records and Gift Aid claims to member lists, rotas, notices, and
              follow-ups, should not fall on a handful of exhausted volunteers juggling
              spreadsheets.
            </p>
          </div>
        </div>
      </section>

      <MarketingSection>
        <div className="grid gap-6 lg:grid-cols-3">
          {STORY.map((item) => (
            <article key={item.title} className="rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <h2 className="font-heading text-xl font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">{item.body}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection tinted>
        <div className="max-w-2xl">
          <MarketingKicker>What we believe</MarketingKicker>
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Principles that shape every feature we ship.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {VALUES.map(({ Icon, title, description }) => (
            <article key={title} className="rounded-3xl border border-[#e9e2d4] bg-white p-8">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-heading text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection>
        <div className="mx-auto grid max-w-5xl gap-8 rounded-[2rem] border border-[#e9e2d4] bg-white p-10 sm:grid-cols-3 lg:p-14">
          {[
            { label: "Focus", value: "UK churches" },
            { label: "Coverage", value: "Giving to pastoral care" },
            { label: "Promise", value: "One shared record" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 font-heading text-2xl font-bold text-slate-900">{item.value}</p>
            </div>
          ))}
        </div>
      </MarketingSection>

      <MarketingCtaBand
        title="Get to know ChurchPay properly."
        body="The best way to understand what we've built is to see it with your own church in mind. Book a walkthrough or just start a conversation."
        secondaryLabel="Contact us"
        secondaryHref="/contact"
      />
    </MarketingShell>
  );
}
