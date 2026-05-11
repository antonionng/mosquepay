import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Mark Masons' Hall Mayfair | London Masonic Venue",
  description:
    "Explore Mark Masons' Hall at 86 St James's Street, Mayfair, the London Masonic venue used by Covenant Lodge. Find venue details, history, transport notes, and lodge contact routes.",
  path: "/venue",
  keywords: [
    "Mark Masons Hall",
    "Masonic venue Mayfair",
    "London Masonic hall",
    "86 St James Street",
  ],
});

const temples = [
  "Grand Temple",
  "Brazil Temple",
  "Bristol Temple",
  "Hong Kong Temple",
  "River Plate Temple",
  "Warwickshire Temple",
  "Johann Gutenberg Temple",
];

export default async function VenuePage({
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
            <p className="public-kicker">Our venue</p>
            <h1 className="public-hero-title">Mark Masons&apos; Hall, Mayfair.</h1>
            <p className="public-hero-body">
              86 St James&apos;s Street, London. A Grade II listed Victorian building and one of the
              city&apos;s most distinguished Masonic venues.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Venue facts</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Temples</p>
                <p className="mt-2 text-2xl font-semibold text-white">7</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Built</p>
                <p className="mt-2 text-2xl font-semibold text-white">1862</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">District</p>
                <p className="mt-2 text-2xl font-semibold text-white">Mayfair</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)] lg:gap-16">
            <div className="public-grid-card">
              <p className="section-label">About the building</p>
              <h2 className="section-title">A distinguished setting for the lodge.</h2>
              <div className="mt-6 space-y-4 leading-relaxed text-slate-600">
                <p>
                  Mark Masons&apos; Hall has been our meeting place for many years. The current
                  building was constructed in 1862 by Sir James Thomas Knowles in the High
                  Victorian style.
                </p>
                <p>
                  The hall opened as Mark Masons&apos; Hall in 1979 and today features seven
                  dedicated Masonic temples, elegant dining rooms, and facilities befitting
                  its Grade II listed status.
                </p>
                <p>
                  Its location in the heart of Mayfair, just off Piccadilly, makes it easily
                  accessible while offering the prestige of one of London&apos;s finest addresses.
                </p>
              </div>
              <div className="mt-10">
                <h3 className="mb-4 font-semibold text-slate-950">The Seven Temples</h3>
                <div className="flex flex-wrap gap-2">
                  {temples.map((t) => (
                    <span key={t} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <Button asChild className="mt-10" variant="outline">
                <Link href={withLodgeQuery("/contact")}>
                  Get in Touch
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="public-stat-card">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Location</p>
                <p className="mt-3 text-lg font-medium text-slate-950">86 St James&apos;s Street</p>
                <p className="mt-1 text-sm text-slate-600">Mayfair, London SW1A 1PL</p>
              </div>
              <div className="public-stat-card">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Nearest station</p>
                <p className="mt-3 text-lg font-medium text-slate-950">Green Park</p>
                <p className="mt-1 text-sm text-slate-600">
                  Piccadilly, Victoria, and Jubilee lines. Roughly a five-minute walk.
                </p>
              </div>
              <div className="public-stat-card">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
                <p className="mt-3 text-lg font-medium text-slate-950">Grade II listed</p>
                <p className="mt-1 text-sm text-slate-600">
                  One of London&apos;s most recognisable Masonic venues.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
