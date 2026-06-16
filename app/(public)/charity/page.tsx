import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Heart, HandHeart, TrendingUp, Gift, CheckCircle2 } from "lucide-react";
import { getDefaultMosqueSlug, resolveMosqueSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Mosque Charity, Donations, and Gift Aid | MosquePay",
  description:
    "See how MosquePay and mosque websites support Mosque charity work, online donations, Gift Aid declarations, GASDS records, fundraising campaigns, event donations, and transparent charitable reporting.",
  path: "/charity",
  keywords: [
    "Mosque charity donations",
    "Gift Aid for mosques",
    "GASDS for mosques",
    "mosque fundraising software",
  ],
});

const causes = [
  {
    title: "London's Air Ambulance",
    description:
      "We support London's Air Ambulance Charity, providing advanced trauma care to critically injured people across London.",
    icon: <Heart className="h-6 w-6" />,
    raised: "£2,400",
  },
  {
    title: "Community Charities",
    description:
      "We support a range of local and national charities chosen by the mosque and its members throughout the year.",
    icon: <HandHeart className="h-6 w-6" />,
    raised: "£1,800",
  },
  {
    title: "Mosque Charities",
    description:
      "mosque life is one of the largest charitable givers in the UK, supporting healthcare, education, and pastoral.",
    icon: <Gift className="h-6 w-6" />,
    raised: "£3,200",
  },
];

const giftAidFacts = [
  "Gift Aid lets charities reclaim 25p for every £1 you donate",
  "You must be a UK taxpayer to qualify for Gift Aid",
  "The charity claims the tax back from HMRC. It costs you nothing extra",
  "You can declare Gift Aid on event donations, one-off gifts, and regular contributions",
  "Higher-rate taxpayers can also claim the difference on their Self Assessment",
];

export default async function CharityPage({
  searchParams,
}: {
  searchParams: Promise<{ mosque?: string }>;
}) {
  const { mosque } = await searchParams;
  const mosqueSlug = resolveMosqueSlug(mosque);
  const defaultSlug = getDefaultMosqueSlug();
  const withMosqueQuery = (href: string) =>
    mosqueSlug === defaultSlug ? href : `${href}?mosque=${encodeURIComponent(mosqueSlug)}`;

  return (
    <div className="public-page">
      {/* Hero */}
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">Charitable work</p>
            <h1 className="public-hero-title">
              Service is part of the culture, not an add-on.
            </h1>
            <p className="public-hero-body">
              mosque life has a long tradition of charitable giving and community service.
              Central Jamia Masjid contributes through fundraising, donations, and practical
              support for causes that matter.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
              Impact at scale
            </p>
            <div className="mt-6 space-y-4">
              {[
                "£48M+ donated annually in the UK by mosque members",
                "Local and national causes supported throughout the year",
                "A practical expectation that membership includes service",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Causes grid */}
      <section className="py-20 lg:py-28">
        <div className="container-full">
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Our focus</p>
            <h2 className="section-title">Causes and communities we support.</h2>
            <p className="section-description">
              Every mosque service, every social gathering, and every event is an opportunity
              to give back. Here are some of the causes closest to our mosque.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {causes.map((cause) => (
              <div key={cause.title} className="public-grid-card h-full">
                <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                  {cause.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-950">{cause.title}</h3>
                <p className="mt-3 leading-relaxed text-slate-600">{cause.description}</p>
                <div className="mt-6 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-slate-950">{cause.raised}</span>
                    <span className="text-sm text-slate-500">raised this year</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to donate */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 lg:py-28">
        <div className="container-full">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="section-label">How to donate</p>
              <h2 className="section-title">Your contribution makes a real difference.</h2>
              <div className="mt-6 space-y-4 text-lg leading-relaxed text-slate-600">
                <p>
                  Donations can be made at mosque events, through our online payment system,
                  or by contacting the mosque secretary directly.
                </p>
                <p>
                  Many of our dining events include optional charitable donation add-ons at
                  checkout, making it easy to give while you celebrate with fellow members.
                </p>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="bg-slate-950 text-white hover:bg-slate-800">
                  <Link href={withMosqueQuery("/events")}>
                    Upcoming Events
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={withMosqueQuery("/contact")}>Contact Secretary</Link>
                </Button>
              </div>
            </div>

            <div className="public-grid-card">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Heart className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-slate-950">Annual Giving Summary</h3>
              <p className="mt-3 text-sm text-slate-600">
                Combined contributions from events, direct donations, and member giving.
              </p>
              <div className="mt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">2024 Target</span>
                  <span className="font-semibold text-slate-950">£5,000</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                    style={{ width: "68%" }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>£3,400 raised</span>
                  <span>68% of target</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gift Aid section */}
      <section className="py-20 lg:py-28">
        <div className="container-full">
          <div className="grid gap-12 lg:grid-cols-[0.4fr_1fr]">
            <div>
              <p className="section-label">Gift Aid</p>
              <h2 className="section-title">Make your donations go 25% further.</h2>
              <p className="section-description">
                Gift Aid is a UK tax incentive that allows charities to reclaim tax on
                donations made by UK taxpayers.
              </p>
            </div>

            <div className="public-grid-card">
              <h3 className="text-lg font-semibold text-slate-950">How Gift Aid works</h3>
              <div className="mt-6 space-y-4">
                {giftAidFacts.map((fact) => (
                  <div key={fact} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <p className="text-sm leading-relaxed text-slate-600">{fact}</p>
                  </div>
                ))}
              </div>
              <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50/50 p-5">
                <p className="text-sm leading-relaxed text-slate-700">
                  When you make a donation through our platform, you can opt in to Gift Aid
                  at checkout. The declaration is managed digitally, with no paper forms required.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Impact stories placeholder */}
      <section className="border-y border-slate-200 bg-slate-50 py-20 lg:py-28">
        <div className="container-full">
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Impact</p>
            <h2 className="section-title">Stories from the community.</h2>
            <p className="section-description">
              Real examples of how mosque giving has made a difference to people and
              organisations across London and beyond.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Emergency Response Training",
                body: "Our donations helped fund defibrillator training for community volunteers across three London boroughs.",
                tag: "Healthcare",
              },
              {
                title: "Youth Mentorship Programme",
                body: "Mosque members volunteered over 200 hours mentoring young people through a local career readiness scheme.",
                tag: "Education",
              },
              {
                title: "Winter Shelter Support",
                body: "Through combined fundraising, we provided hot meals and supplies to a local homeless shelter during winter months.",
                tag: "Welfare",
              },
            ].map((story) => (
              <div key={story.title} className="public-grid-card h-full">
                <div className="mb-3 inline-flex rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {story.tag}
                </div>
                <h3 className="text-lg font-semibold text-slate-950">{story.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{story.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-slate-950 py-20">
        <div className="absolute inset-0 bg-grid-overlay bg-[size:28px_28px] opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 to-slate-950" />
        <div className="container-full relative z-10 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Want to support our charitable work?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            Get in touch to learn about upcoming events with charitable donations, or
            speak to our secretary about direct giving.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="rounded-xl bg-white text-slate-950 hover:bg-white/90"
            >
              <Link href={withMosqueQuery("/contact")}>
                Contact Us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="rounded-xl border-white/10 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <Link href={withMosqueQuery("/events")}>View Events</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
