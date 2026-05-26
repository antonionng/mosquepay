import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/utils";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { EventRsvpForm } from "@/components/forms/event-rsvp-form";
import { ArrowLeft, Calendar, MapPin, Clock, Users } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";
import { SOCIAL_SHARE_IMAGE, SITE_ORIGIN } from "@/lib/seo";
import { lodgeScopedEventPath, lodgeScopedEventsPath } from "@/lib/public-links";
import { isPubliclyVisible } from "@/lib/events/public-visibility";

function siteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    SITE_ORIGIN;
  return url.startsWith("http") ? url : `https://${url}`;
}

async function loadEvent(slug: string, lodgeSlug: string) {
  if (isSupabaseConfigured()) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    return lodgeId ? await db.getEventBySlug(slug, lodgeId) : null;
  }
  if (shouldUseInMemoryMock()) {
    return mockDb.getEventBySlug(slug, { lodge_slug: lodgeSlug });
  }
  return null;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lodge?: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { lodge } = await searchParams;
  const lodgeSlug = resolveLodgeSlug(lodge);
  const event = await loadEvent(slug, lodgeSlug);
  if (!event || !isPubliclyVisible(event)) return { title: "Event not found" };
  const description = (event.description ?? "").slice(0, 200) ||
    `${event.title} - ${formatDate(event.event_date)}`;
  const canonical = `${siteUrl()}/events/${slug}${
    lodgeSlug !== getDefaultLodgeSlug() ? `?lodge=${encodeURIComponent(lodgeSlug)}` : ""
  }`;
  const imageUrl = event.featured_image_url || SOCIAL_SHARE_IMAGE.url;
  return {
    title: event.title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: event.title,
      description,
      url: canonical,
      images: [imageUrl],
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [imageUrl],
    },
  };
}

function eventDateTimeValue(date: string, time: string | null) {
  if (!time) return date;
  return `${new Date(date).toISOString().slice(0, 10)}T${time}`;
}

type LinkMode = "query" | "scoped";

export async function EventPageContent({
  slug,
  lodge,
  linkMode = "query",
}: {
  slug: string;
  lodge?: string;
  linkMode?: LinkMode;
}) {
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeLink = (href: string) => {
    if (linkMode === "scoped" && href === "/events") {
      return lodgeScopedEventsPath(lodgeSlug);
    }
    return lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;
  };

  const event = await loadEvent(slug, lodgeSlug);
  if (!event) notFound();
  if (!isPubliclyVisible(event)) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.description ?? undefined,
    startDate: eventDateTimeValue(event.event_date, event.event_time),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.location
      ? {
          "@type": "Place",
          name: event.location,
        }
      : undefined,
    image: event.featured_image_url ? [event.featured_image_url] : undefined,
    url:
      linkMode === "scoped"
        ? `${siteUrl()}${lodgeScopedEventPath(lodgeSlug, slug)}`
        : `${siteUrl()}/events/${slug}`,
  };

  const hasPayments =
    event.enable_payments &&
    (event.enable_dining_rsvp ||
      event.enable_charity_donation ||
      event.enable_raffle_donation ||
      event.enable_meeting_fee ||
      event.enable_guest_tickets);

  return (
    <div className="public-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="public-hero">
        <div className="container-full relative z-10 max-w-4xl px-6 pb-16 pt-32 md:pb-20 md:pt-40">
          <Link 
            href={withLodgeLink("/events")}
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-blue-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to events
          </Link>
          
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-blue-200 capitalize">
              {event.event_type.replace(/_/g, " ")}
            </span>
          </div>
          
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-5xl">
            {event.title}
          </h1>
          
          <div className="mt-8 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-white/70">
              <Calendar className="h-4 w-4 text-blue-300" />
              {formatDate(event.event_date)}
            </div>
            {event.event_time && (
              <div className="flex items-center gap-2 text-white/70">
                <Clock className="h-4 w-4 text-blue-300" />
                {event.event_time}
              </div>
            )}
            {event.location && (
              <div className="flex items-center gap-2 text-white/70">
                <MapPin className="h-4 w-4 text-blue-300" />
                {event.location}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full max-w-4xl">
          {event.description && (
            <div className="mb-12">
              <p className="text-lg leading-relaxed text-slate-700">{event.description}</p>
            </div>
          )}
          
          <div className="public-grid-card mb-12">
            <h3 className="mb-6 text-xl font-semibold text-slate-950">Event details</h3>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">Date & Time</p>
                <p className="font-medium text-slate-950">
                  {formatDateTime(eventDateTimeValue(event.event_date, event.event_time))}
                </p>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">Location</p>
                <p className="font-medium text-slate-950">{event.location ?? "Mark Masons' Hall"}</p>
              </div>
              {event.dress_code && (
                <div>
                  <p className="mb-1 text-sm font-medium uppercase tracking-wider text-slate-500">Dress Code</p>
                  <p className="font-medium text-slate-950">{event.dress_code}</p>
                </div>
              )}
            </div>
          </div>

          {event.enable_rsvp && (
            <div className="public-grid-card p-8 md:p-10">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-100 bg-blue-50">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">RSVP</h2>
                  <p className="text-slate-600">Reserve your place at this event</p>
                </div>
              </div>
              
              <EventRsvpForm
                eventId={event.id}
                lodgeSlug={lodgeSlug}
                enableDining={event.enable_dining_rsvp}
                diningPrice={event.dining_price}
                diningDescription={event.dining_description}
                enableCharity={event.enable_charity_donation}
                charityName={event.charity_name}
                charitySuggestedAmounts={event.charity_suggested_amounts ?? [10, 20, 50, 100]}
                charityAllowCustom={event.charity_allow_custom}
                enableRaffle={event.enable_raffle_donation}
                raffleSuggestedAmounts={event.raffle_suggested_amounts ?? [5, 10, 20, 50]}
                raffleAllowCustom={event.raffle_allow_custom}
                enableMeetingFee={event.enable_meeting_fee}
                meetingFeeAmount={event.meeting_fee_amount}
                meetingFeeDescription={event.meeting_fee_description}
                enableGuestTickets={event.enable_guest_tickets}
                guestTicketPrice={event.guest_ticket_price}
                guestTicketDescription={event.guest_ticket_description}
                hasPayments={hasPayments ?? false}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default async function EventPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { slug } = await params;
  const { lodge } = await searchParams;
  return <EventPageContent slug={slug} lodge={lodge} />;
}
