import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Calendar, Clock, MapPin, Shirt } from "lucide-react";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import { filterPubliclyVisible } from "@/lib/events/public-visibility";
import { VisitorRegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Join the visitor directory",
  robots: { index: true, follow: true },
};

type LodgeLike = {
  slug: string;
  name: string;
  logo_url: string | null;
  visiting_notice: string | null;
  accepts_self_registration: boolean;
};

type EventLike = {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  dress_code: string | null;
  description: string | null;
  guest_policy: "blue_table" | "white_table" | "closed";
};

export default async function PublicVisitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let lodge: LodgeLike | null = null;
  let upcomingEvents: EventLike[] = [];

  if (isSupabaseConfigured()) {
    const row = await db.getLodgeBySlug(slug);
    if (row) {
      lodge = {
        slug: row.slug,
        name: row.name,
        logo_url: row.logo_url,
        visiting_notice: row.visiting_notice,
        accepts_self_registration: row.accepts_self_registration ?? false,
      };
      if (lodge.accepts_self_registration) {
        const events = await db.getEvents(row.id, {
          published: true,
          upcoming: true,
        });
        upcomingEvents = filterPubliclyVisible(events).map((e) => ({
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          event_time: e.event_time,
          location: e.location,
          dress_code: e.dress_code,
          description: e.description,
          guest_policy: e.guest_policy,
        }));
      }
    }
  } else if (shouldUseInMemoryMock()) {
    const row = mockDb.getLodgeBySlug(slug);
    if (row) {
      lodge = {
        slug: row.slug,
        name: row.name,
        logo_url: row.logo_url,
        visiting_notice: row.visiting_notice,
        accepts_self_registration: row.accepts_self_registration ?? false,
      };
      if (lodge.accepts_self_registration) {
        const events = mockDb.getEvents({
          lodge_slug: row.slug,
          published: true,
          upcoming: true,
        });
        upcomingEvents = filterPubliclyVisible(events).map((e) => ({
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          event_time: e.event_time,
          location: e.location,
          dress_code: e.dress_code,
          description: e.description,
          guest_policy: e.guest_policy,
        }));
      }
    }
  }

  if (!lodge) notFound();

  if (!lodge.accepts_self_registration) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">
            Registration not available
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            {lodge.name} is not accepting public visitor registrations at the
            moment. Please contact the lodge secretary if you would like to
            visit.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center gap-4">
            {lodge.logo_url ? (
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Image
                  src={lodge.logo_url}
                  alt={`${lodge.name} logo`}
                  width={56}
                  height={56}
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Visitors welcome
              </p>
              <p className="text-sm text-slate-500">{lodge.name}</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Join the {lodge.name} visitor directory
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Add yourself to our directory and we will send you a private link
            you can use to book yourself into open events. Visiting brethren
            and social guests are both welcome.
          </p>
          {lodge.visiting_notice ? (
            <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {lodge.visiting_notice}
            </p>
          ) : null}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-xl font-semibold text-slate-950">
            Tell us about yourself
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Your details are kept private and shared only with the lodge
            officers responsible for hosting.
          </p>
          <div className="mt-6">
            <VisitorRegisterForm lodgeSlug={lodge.slug} />
          </div>
        </section>

        {upcomingEvents.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <h2 className="text-xl font-semibold text-slate-950">
              Upcoming events
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Once you are registered you can book any of these in a single
              click.
            </p>
            <ul className="mt-6 space-y-4">
              {upcomingEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                    {event.guest_policy === "blue_table"
                      ? "Visiting brethren only"
                      : "Open to all"}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {event.title}
                  </p>
                  <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <li className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      {formatDate(event.event_date)}
                    </li>
                    {event.event_time ? (
                      <li className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                        {event.event_time}
                      </li>
                    ) : null}
                    {event.location ? (
                      <li className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                        {event.location}
                      </li>
                    ) : null}
                    {event.dress_code ? (
                      <li className="inline-flex items-center gap-1.5">
                        <Shirt className="h-3.5 w-3.5 text-blue-600" />
                        {event.dress_code}
                      </li>
                    ) : null}
                  </ul>
                  {event.description ? (
                    <p className="mt-3 text-sm text-slate-600">
                      {event.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-xs text-slate-400">
          By submitting you agree to be added to the lodge&apos;s private
          visitor directory. You can ask the secretary to remove your details
          at any time.
        </p>
      </article>
    </main>
  );
}
