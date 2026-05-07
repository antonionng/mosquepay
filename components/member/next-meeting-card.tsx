"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Sparkles,
  XCircle,
} from "lucide-react";

type NextEvent = {
  id: string;
  title: string;
  slug: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  dress_code: string | null;
  enable_rsvp: boolean;
  enable_dining_rsvp: boolean;
  dining_price: number | null;
  current_rsvp: {
    id: string;
    status: string;
    attending_ceremony: boolean;
    attending_dining: boolean;
  } | null;
};

export function NextMeetingCard({ nextEvent }: { nextEvent: NextEvent | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"attending" | "apologies" | null>(null);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!nextEvent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
            <CalendarDays className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">No meetings scheduled</p>
            <p className="text-xs text-slate-500">
              You will see your next meeting here when it is published.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const eventDate = new Date(nextEvent.event_date);
  const dateLabel = eventDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeLabel = nextEvent.event_time ?? "Time TBC";
  const status = nextEvent.current_rsvp?.status;

  async function submit(action: "attending" | "apologies") {
    if (!nextEvent || !nextEvent.enable_rsvp) return;
    setBusy(action);
    setFeedback(null);
    try {
      const res = await fetch(`/api/member/events/${nextEvent.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attending_ceremony: action === "attending",
          attending_dining:
            action === "attending" && nextEvent.enable_dining_rsvp,
          reason: action === "apologies" ? reason : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save RSVP.");
      }
      setFeedback(
        action === "attending"
          ? "You are confirmed for this meeting."
          : "Your apologies have been sent to the secretary."
      );
      setReason("");
      router.refresh();
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Could not save RSVP."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.18em] text-white/70">
              Next meeting
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold">
              {nextEvent.title}
            </h2>
          </div>
          {status && (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider`}
            >
              <Sparkles className="h-3 w-3" />
              {status}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/85">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> {dateLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {timeLabel}
          </span>
          {nextEvent.location && (
            <span className="inline-flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5" /> {nextEvent.location}
            </span>
          )}
          {nextEvent.dress_code && (
            <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
              {nextEvent.dress_code}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3 px-6 py-5">
        {!nextEvent.enable_rsvp ? (
          <p className="text-sm text-slate-500">
            RSVP is not enabled for this meeting yet.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => submit("attending")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy === "attending" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                I will be there
                {nextEvent.enable_dining_rsvp && nextEvent.dining_price != null
                  ? ` (dining £${nextEvent.dining_price.toFixed(2)})`
                  : ""}
              </button>
              <button
                type="button"
                onClick={() => submit("apologies")}
                disabled={busy !== null}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
              >
                {busy === "apologies" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-600" />
                )}
                Send apologies
              </button>
            </div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional message with your apologies"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400"
            />
            {feedback && (
              <p className="text-xs text-slate-500">{feedback}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
