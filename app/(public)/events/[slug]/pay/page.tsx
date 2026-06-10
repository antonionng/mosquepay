import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getDefaultChurchSlug, resolveChurchSlug } from "@/lib/tenant";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { StandalonePayForm } from "@/components/forms/standalone-pay-form";

export default async function StandalonePayPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ church?: string }>;
}) {
  const { slug } = await params;
  const { church } = await searchParams;
  const churchSlug = resolveChurchSlug(church);
  const defaultSlug = getDefaultChurchSlug();
  const withChurchQuery = (href: string) =>
    churchSlug === defaultSlug ? href : `${href}?church=${encodeURIComponent(churchSlug)}`;

  const useDb = isSupabaseConfigured();
  let event;
  if (useDb) {
    const churchId = await db.resolveChurchId(churchSlug);
    event = churchId ? await db.getEventBySlug(slug, churchId) : null;
  } else if (shouldUseInMemoryMock()) {
    event = mockDb.getEventBySlug(slug, { church_slug: churchSlug });
  } else {
    event = null;
  }

  if (!event || !event.enable_payments) notFound();

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="container-full relative z-10 max-w-3xl px-6 pb-12 pt-28 md:pb-16 md:pt-36">
          <Link
            href={withChurchQuery(`/events/${slug}`)}
            className="mb-6 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-blue-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to event
          </Link>
          <h1 className="text-3xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-4xl">
            Pay for {event.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2 text-white/70">
              <Calendar className="h-4 w-4 text-blue-300" />
              {formatDate(event.event_date)}
            </span>
            {event.location && (
              <span className="flex items-center gap-2 text-white/70">
                <MapPin className="h-4 w-4 text-blue-300" />
                {event.location}
              </span>
            )}
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full max-w-3xl">
          <div className="public-grid-card p-8 md:p-10">
            <h2 className="mb-6 text-xl font-semibold text-slate-950">Payment</h2>
            <StandalonePayForm
              eventId={event.id}
              churchSlug={churchSlug}
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
              enableServiceFee={event.enable_service_fee}
              serviceFeeAmount={event.service_fee_amount}
              serviceFeeDescription={event.service_fee_description}
              enableGuestTickets={event.enable_guest_tickets}
              guestTicketPrice={event.guest_ticket_price}
              guestTicketDescription={event.guest_ticket_description}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
