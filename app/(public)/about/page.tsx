import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Timeline } from "@/components/timeline";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";

const timelineItems = [
  {
    year: "1921",
    title: "Warrant issued",
    description:
      "Covenant Lodge's warrant was issued on 7 September 1921 by the United Grand Lodge of England.",
  },
  {
    year: "1922",
    title: "Consecration",
    description:
      "The lodge was consecrated on 3 April 1922 at Freemasons' Hall, Great Queen Street, London.",
  },
  {
    year: "1979",
    title: "Mark Masons' Hall opens",
    description:
      "Our current venue at 86 St James's Street opened as Mark Masons' Hall.",
  },
  {
    year: "Today",
    title: "Continuing the work",
    description:
      "We meet in Mayfair, welcome new members, and uphold the principles of Freemasonry.",
  },
];

const values = [
  {
    title: "Integrity",
    description: "Honesty and moral principles that guide how members conduct themselves.",
  },
  {
    title: "Friendship",
    description: "Long-term relationships built through respect, reliability, and fellowship.",
  },
  {
    title: "Charity",
    description: "A practical commitment to helping others and supporting worthwhile causes.",
  },
  {
    title: "Self-improvement",
    description: "An expectation that membership should shape you positively over time.",
  },
];

export default async function AboutPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">About Covenant Lodge</p>
            <h1 className="public-hero-title">A London lodge with history, standards, and continuity.</h1>
            <p className="public-hero-body">
              Founded in 1922, Covenant Lodge continues the traditions of Freemasonry in a way
              that feels grounded, welcoming, and relevant to modern life.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Snapshot</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Founded</p>
                <p className="mt-2 text-2xl font-semibold text-white">1922</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Venue</p>
                <p className="mt-2 text-2xl font-semibold text-white">Mayfair</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Focus</p>
                <p className="mt-2 text-2xl font-semibold text-white">Character</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] lg:items-start">
            <div className="public-grid-card">
              <p className="section-label">Our history</p>
              <h2 className="section-title">Over a century of brotherhood in London.</h2>
              <div className="mt-6 space-y-4 leading-relaxed text-slate-600">
                <p>
                  Covenant Lodge was constituted under a warrant dated 7 September 1921 and
                  consecrated on 3 April 1922 at Freemasons&apos; Hall, Great Queen Street, London.
                </p>
                <p>
                  For more than 100 years, the lodge has brought together men of good character
                  with a shared commitment to integrity, friendship, and service.
                </p>
                <p>
                  Today we meet at Mark Masons&apos; Hall in Mayfair, a Grade II listed building
                  that provides a fitting home for a lodge with deep roots and clear standards.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              {[
                { label: "Founded", value: "1922" },
                { label: "Years of continuity", value: "100+" },
                { label: "Meeting place", value: "Mayfair" },
              ].map((item) => (
                <div key={item.label} className="public-stat-card">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="container-full">
          <div className="mb-14 max-w-2xl">
            <p className="section-label">What we believe</p>
            <h2 className="section-title">Principles that shape the culture of the lodge.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {values.map((value) => (
              <div key={value.title} className="public-grid-card h-full">
                <div className="mb-5 h-px w-12 bg-blue-500" />
                <h3 className="text-xl font-semibold text-slate-950">{value.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full">
          <div className="mb-14 max-w-2xl">
            <p className="section-label">Our journey</p>
            <h2 className="section-title">Key moments in the lodge&apos;s development.</h2>
          </div>
          <div className="max-w-4xl">
            <Timeline items={timelineItems} />
          </div>
        </div>
      </section>

      <section className="public-section public-section-muted">
        <div className="container-full">
          <div className="public-cta-panel mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white">
              Interested in learning more?
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
              We welcome enquiries from men of good character who are curious about Freemasonry
              and what membership could offer them.
            </p>
            <Button asChild size="lg" variant="primary" className="mt-8">
              <Link href={withLodgeQuery("/join")}>Express Your Interest</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
