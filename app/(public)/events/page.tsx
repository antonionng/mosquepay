import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const isTenantMode = Boolean(lodge);
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  if (!isTenantMode) {
    const productEvents = [
      {
        id: "webinar-ops",
        title: "LodgePay Operations Webinar",
        event_date: "2026-05-12T18:00:00.000Z",
        event_type: "webinar",
        location: "Online",
      },
      {
        id: "demo-clinic",
        title: "Live Demo Clinic: Payments + Candidate CRM",
        event_date: "2026-05-20T12:00:00.000Z",
        event_type: "product_demo",
        location: "Online",
      },
    ];

    return (
      <div className="public-page">
        <section className="public-hero">
          <div className="public-hero-shell">
            <div className="public-hero-copy">
              <p className="public-kicker">LodgePay Events</p>
              <h1 className="public-hero-title">Webinars and product walkthroughs.</h1>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="container-full">
            <div className="grid gap-6 md:grid-cols-2">
              {productEvents.map((event) => (
                <div key={event.id} className="public-grid-card">
                  <p className="text-sm font-medium text-blue-600">{formatDate(event.event_date)}</p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{event.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{event.location}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/book-demo" className="text-sm font-medium text-blue-600 hover:underline">
                Prefer a dedicated session? Book demo.
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
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
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    const raw = lodgeId
      ? await db.getEvents(lodgeId, { published: true, upcoming: true })
      : [];
    events = raw.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      event_date: e.event_date,
      event_type: e.event_type,
      location: e.location ?? "",
    }));
  } else if (shouldUseInMemoryMock()) {
    events = mockDb.getEvents({ published: true, upcoming: true, lodge_slug: lodgeSlug }).map((e) => ({
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
            <h1 className="public-hero-title">Upcoming lodge events and gatherings.</h1>
            <p className="public-hero-body">
              Meetings, social events, and charitable activities. See what&apos;s coming up and
              follow through for full details and RSVP information.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">What you&apos;ll find</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>Upcoming lodge meetings</p>
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
                  href={withLodgeQuery(`/events/${e.slug}`)}
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
                Check back soon for upcoming lodge meetings and social events, or{" "}
                <Link href={withLodgeQuery("/contact")} className="text-blue-600 hover:underline">
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
