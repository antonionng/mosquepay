"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Tag,
  CheckCircle2,
  ExternalLink,
  CalendarX2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LodgeEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  type?: string;
  description?: string;
  rsvpStatus?: "confirmed" | "pending" | null;
}

function EventSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-14 w-14 rounded-xl bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 rounded bg-slate-100" />
          <div className="h-4 w-1/2 rounded bg-slate-100" />
          <div className="h-4 w-1/3 rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function MemberEventsPage() {
  const [events, setEvents] = useState<LodgeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/events?lodge=covenant-4344");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.events ?? [];
          setEvents(list);
        }
      } catch {
        setError("Could not load events. Try refreshing the page.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function formatEventDate(dateStr: string) {
    try {
      const d = new Date(dateStr);
      return {
        day: d.getDate(),
        month: d.toLocaleString("en-GB", { month: "short" }).toUpperCase(),
        full: d.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
      };
    } catch {
      return { day: "--", month: "---", full: dateStr };
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <p className="text-slate-500 mt-1">Upcoming lodge events and meetings</p>
      </div>

      <div className="space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {loading ? (
          <>
            <EventSkeleton />
            <EventSkeleton />
            <EventSkeleton />
          </>
        ) : events.length > 0 ? (
          events.map((event) => {
            const { day, month, full } = formatEventDate(event.date);
            return (
              <div
                key={event.id}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-5">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-blue-50 px-3 py-2 min-w-[60px]">
                    <span className="text-xs font-bold text-blue-600 uppercase">{month}</span>
                    <span className="text-2xl font-bold text-slate-900 leading-tight">{day}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">
                          {event.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {full}
                            {event.time && ` at ${event.time}`}
                          </span>
                          {event.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" />
                              {event.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {event.type && (
                          <Badge variant="default">
                            <Tag className="h-3 w-3 mr-1" />
                            {event.type}
                          </Badge>
                        )}
                        {event.rsvpStatus === "confirmed" && (
                          <Badge variant="success">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            RSVPed
                          </Badge>
                        )}
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-sm text-slate-500 mt-3 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    <div className="mt-4">
                      {event.rsvpStatus === "confirmed" ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                          <CheckCircle2 className="h-4 w-4" />
                          You&apos;re attending
                        </span>
                      ) : (
                        <Link href={`/events/${event.id}`}>
                          <Button variant="primary" size="sm">
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            View &amp; RSVP
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 shadow-sm">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 mb-4">
              <CalendarX2 className="h-7 w-7 text-slate-300" />
            </div>
            <p className="text-base font-medium text-slate-500">No upcoming events</p>
            <p className="text-sm text-slate-400 mt-1">
              Check back soon for new events from your lodge.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
