import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { Calendar, Clock, MapPin, Shirt, History } from "lucide-react";
import {
  isSupabaseConfigured,
  shouldUseInMemoryMock,
} from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { hashNewcomerToken } from "@/lib/guest-tokens";
import { formatDate } from "@/lib/utils";
import { NewcomerDetailsForm } from "./dietary-form";
import { NewcomerBookButton } from "./book-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your newcomer profile",
  robots: { index: false, follow: false, nocache: true },
};

type GuestLike = {
  id: string;
  church_id: string | null;
  church_slug: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  mother_church_name: string | null;
  mother_church_number: string | null;
  constitution: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  is_member: boolean;
  visit_count: number;
};

type ChurchLike = {
  id: string | null;
  name: string;
  logo_url: string | null;
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

type PastVisit = {
  id: string;
  event_title: string;
  event_date: string;
  attended: boolean;
};

const PAGE_LOADED_AT_MS = Date.now();

export default async function NewcomerPortalPage({
  params,
  expectedChurchSlug,
}: {
  params: Promise<{ token: string }>;
  expectedChurchSlug?: string;
}) {
  const { token } = await params;
  const tokenHash = hashNewcomerToken(token);

  let guest: GuestLike | null = null;
  let church: ChurchLike | null = null;
  let upcomingEvents: EventLike[] = [];
  let pastVisits: PastVisit[] = [];

  if (isSupabaseConfigured()) {
    const found = await db.getGuestByNewcomerTokenHash(tokenHash);
    if (found) {
      const churchRow = await db.getChurchById(found.church_id);
      guest = {
        id: found.id,
        church_id: found.church_id,
        church_slug: churchRow?.slug ?? expectedChurchSlug ?? "",
        full_name: found.full_name,
        email: found.email,
        phone: found.phone,
        mother_church_name: found.mother_church_name,
        mother_church_number: found.mother_church_number,
        constitution: found.constitution,
        rank: found.rank,
        dietary_requirements: found.dietary_requirements,
        is_member: found.is_member,
        visit_count: found.visit_count,
      };
      church = churchRow
        ? { id: churchRow.id, name: churchRow.name, logo_url: churchRow.logo_url }
        : {
            id: found.church_id,
            name: "the church",
            logo_url: null,
          };
      {
        const events = await db.getEvents(found.church_id, {
          published: true,
          upcoming: true,
        });
        upcomingEvents = events
          .filter((e) => e.guest_policy !== "closed")
          .map((e) => ({
            id: e.id,
            title: e.title,
            event_date: e.event_date,
            event_time: e.event_time,
            location: e.location,
            dress_code: e.dress_code,
            description: e.description,
            guest_policy: e.guest_policy,
          }));
        const eventGuestRows = await db.listEventGuestsForChurch(found.church_id, {
          guestId: found.id,
        });
        const ids = Array.from(new Set(eventGuestRows.map((g) => g.event_id)));
        const eventMap = new Map<
          string,
          { title: string; event_date: string }
        >();
        await Promise.all(
          ids.map(async (id) => {
            const ev = await db.getEventById(id, found.church_id);
            if (ev) {
              eventMap.set(id, {
                title: ev.title,
                event_date: ev.event_date,
              });
            }
          })
        );
        pastVisits = eventGuestRows
          .map((eg) => {
            const meta = eventMap.get(eg.event_id);
            if (!meta) return null;
            return {
              id: eg.id,
              event_title: meta.title,
              event_date: meta.event_date,
              attended: new Date(meta.event_date).getTime() < PAGE_LOADED_AT_MS,
            };
          })
          .filter((x): x is PastVisit => x !== null)
          .sort(
            (a, b) =>
              new Date(b.event_date).getTime() -
              new Date(a.event_date).getTime()
          );
      }
    }
  } else if (shouldUseInMemoryMock()) {
    const found = mockDb.getGuestByNewcomerTokenHash(tokenHash);
    if (found) {
      const churchRow = mockDb.getChurchBySlug(found.church_slug);
      guest = {
        id: found.id,
        church_id: null,
        church_slug: found.church_slug,
        full_name: found.full_name,
        email: found.email,
        phone: found.phone,
        mother_church_name: found.mother_church_name,
        mother_church_number: found.mother_church_number,
        constitution: found.constitution,
        rank: found.rank,
        dietary_requirements: found.dietary_requirements,
        is_member: found.is_member,
        visit_count: found.visit_count,
      };
      church = churchRow
        ? { id: null, name: churchRow.name, logo_url: churchRow.logo_url }
        : null;
      const events = mockDb.getEvents({
        church_slug: found.church_slug,
        published: true,
        upcoming: true,
      });
      upcomingEvents = events
        .filter((e) => e.guest_policy !== "closed")
        .map((e) => ({
          id: e.id,
          title: e.title,
          event_date: e.event_date,
          event_time: e.event_time,
          location: e.location,
          dress_code: e.dress_code,
          description: e.description,
          guest_policy: e.guest_policy,
        }));
      const eventGuestRows = mockDb.listEventGuestsForChurch({
        church_slug: found.church_slug,
        guestId: found.id,
      });
      pastVisits = eventGuestRows
        .map((eg) => {
          const ev = mockDb.getEventById(eg.event_id, {
            church_slug: found.church_slug,
          });
          if (!ev) return null;
          return {
            id: eg.id,
            event_title: ev.title,
            event_date: ev.event_date,
            attended: new Date(ev.event_date).getTime() < PAGE_LOADED_AT_MS,
          };
        })
        .filter((x): x is PastVisit => x !== null)
        .sort(
          (a, b) =>
            new Date(b.event_date).getTime() -
            new Date(a.event_date).getTime()
        );
    }
  }

  if (!guest || !church) notFound();
  if (expectedChurchSlug && guest.church_slug !== expectedChurchSlug) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="flex items-center gap-4">
            {church.logo_url ? (
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <Image
                  src={church.logo_url}
                  alt={`${church.name} logo`}
                  width={56}
                  height={56}
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
            ) : null}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                Your newcomer profile
              </p>
              <p className="text-sm text-slate-500">{church.name}</p>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            Welcome back, {firstName(guest.full_name)}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Your details are saved here so you can book future visits in a
            single click. Update your dietary requirements at any time.
          </p>
          {guest.visit_count > 0 ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              <History className="h-3.5 w-3.5" />
              {guest.visit_count}{" "}
              {guest.visit_count === 1 ? "visit" : "visits"} recorded
            </p>
          ) : null}
        </header>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-xl font-semibold text-slate-950">Your details</h2>
          <p className="mt-2 text-sm text-slate-500">
            Edit your contact or dietary details below.
          </p>
          <div className="mt-6">
            <NewcomerDetailsForm
              token={token}
              initial={{
                full_name: guest.full_name,
                email: guest.email ?? "",
                phone: guest.phone ?? "",
                dietary_requirements: guest.dietary_requirements ?? "",
              }}
            />
          </div>
          {guest.mother_church_name ? (
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <Detail label="Mother church">
                {guest.mother_church_name}
                {guest.mother_church_number
                  ? ` No. ${guest.mother_church_number}`
                  : ""}
              </Detail>
              {guest.constitution ? (
                <Detail label="Constitution">{guest.constitution}</Detail>
              ) : null}
              {guest.rank ? <Detail label="Rank">{guest.rank}</Detail> : null}
            </dl>
          ) : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-xl font-semibold text-slate-950">
            Upcoming events
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {guest.is_member
              ? "Open services (white table) and members-only (blue table) events you can attend."
              : "Open events you can attend."}
          </p>
          {upcomingEvents.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
              No upcoming events are open to newcomers right now. We&apos;ll let
              you know when something is announced.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {upcomingEvents
                .filter((e) =>
                  e.guest_policy === "blue_table" ? guest.is_member : true
                )
                .map((event) => (
                  <li
                    key={event.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
                          {event.guest_policy === "blue_table"
                            ? "Newcomer members only"
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
                      </div>
                      <NewcomerBookButton
                        token={token}
                        eventId={event.id}
                        eventTitle={event.title}
                      />
                    </div>
                    {event.description ? (
                      <p className="mt-4 text-sm text-slate-600">
                        {event.description}
                      </p>
                    ) : null}
                  </li>
                ))}
            </ul>
          )}
        </section>

        {pastVisits.length > 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <h2 className="text-xl font-semibold text-slate-950">
              Visit history
            </h2>
            <ul className="mt-4 divide-y divide-slate-100">
              {pastVisits.map((visit) => (
                <li
                  key={visit.id}
                  className="flex items-start justify-between gap-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {visit.event_title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(visit.event_date)}
                    </p>
                  </div>
                  <p
                    className={
                      visit.attended
                        ? "text-xs font-medium text-emerald-700"
                        : "text-xs font-medium text-amber-700"
                    }
                  >
                    {visit.attended ? "Attended" : "Booked"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <p className="text-center text-xs text-slate-400">
          This link is private. Please do not share it publicly.
        </p>
      </article>
    </main>
  );
}

function firstName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  if (
    /^(w|v|r|m)?\.?\s*(bro|wbro|vwbro|rwbro|mwbro|member)\.?$/i.test(parts[0])
  ) {
    return parts[1] ?? parts[0];
  }
  return parts[0];
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-0.5 font-medium text-slate-950">{children}</dd>
    </div>
  );
}
