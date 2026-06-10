import Link from "next/link";
import { notFound } from "next/navigation";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { getDefaultChurchSlug, resolveChurchSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";
import { churchScopedEventPath } from "@/lib/public-links";
import { filterPubliclyVisible } from "@/lib/events/public-visibility";
import { formatDate } from "@/lib/utils";

export const metadata = marketingMetadata({
  title: "Church Event RSVP and Payment Software | ChurchPay Events",
  description:
    "Manage church services, fellowship meals, social events, dining choices, RSVPs, online event payments, notice links, attendee lists, and charitable donation add-ons with ChurchPay.",
  path: "/events",
  keywords: [
    "Church event software",
    "church RSVP software",
    "fellowship meal payments",
    "Church service management",
  ],
});

type LinkMode = "query" | "scoped";

export async function EventsPageContent({
  church,
  linkMode = "query",
}: {
  church?: string;
  linkMode?: LinkMode;
}) {
  const isTenantMode = Boolean(church);
  const churchSlug = resolveChurchSlug(church);
  const defaultSlug = getDefaultChurchSlug();
  const withChurchLink = (href: string) => {
    if (linkMode === "scoped" && href.startsWith("/events/")) {
      return churchScopedEventPath(churchSlug, href.replace("/events/", ""));
    }
    return churchSlug === defaultSlug ? href : `${href}?church=${encodeURIComponent(churchSlug)}`;
  };

  if (!isTenantMode) {
    notFound();
  }

  const useDb = isSupabaseConfigured();
  let events: Array<{
    id: string;
    title: string;
    slug: string;
    event_date: string;
    event_type: string;
    location: string;
  }>;

  if (useDb) {
    const churchId = await db.resolveChurchId(churchSlug);
    const raw = churchId
      ? await db.getEvents(churchId, { published: true, upcoming: true })
      : [];
    events = filterPubliclyVisible(raw).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      event_date: e.event_date,
      event_type: e.event_type,
      location: e.location ?? "",
    }));
  } else if (shouldUseInMemoryMock()) {
    const raw = mockDb.getEvents({
      published: true,
      upcoming: true,
      church_slug: churchSlug,
    });
    events = filterPubliclyVisible(raw).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      event_date: e.event_date,
      event_type: e.event_type,
      location: e.location ?? "",
    }));
  } else {
    events = [];
  }

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">Events</p>
            <h1 className="public-hero-title">Upcoming church events and gatherings.</h1>
            <p className="public-hero-body">
              Services, social events, and charitable activities. See what&apos;s coming up and
              follow through for full details and RSVP information.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">What you&apos;ll find</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>Upcoming church services</p>
              <p>Social events and dining</p>
              <p>Published event details and RSVP information</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full">
          {events.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {events.map((e) => (
                <Link
                  key={e.id}
                  href={withChurchLink(`/events/${e.slug}`)}
                  className="group public-grid-card block h-full"
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                      {e.event_type.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs uppercase tracking-[0.16em] text-slate-400">
                      Event
                    </span>
                  </div>
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600">
                      <Calendar className="h-4 w-4" />
                      {formatDate(e.event_date)}
                    </div>
                    <h2 className="text-xl font-semibold text-slate-950 transition-colors group-hover:text-blue-700">
                      {e.title}
                    </h2>
                    {e.location && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                        <MapPin className="h-4 w-4" />
                        {e.location}
                      </div>
                    )}
                    <div className="mt-6 flex items-center gap-1 text-sm font-medium text-blue-600">
                      View details
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Calendar className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-slate-900">No upcoming events</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Check back soon for upcoming church services and social events, or{" "}
                <Link href={withChurchLink("/contact")} className="text-blue-600 hover:underline">
                  get in touch
                </Link>{" "}
                to learn more.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}) {
  const { church } = await searchParams;
  return <EventsPageContent church={church} />;
}
