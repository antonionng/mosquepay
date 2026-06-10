"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type EventOption = {
  id: string;
  title: string;
  event_date: string;
  guest_policy: "blue_table" | "white_table" | "closed";
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guestId: string;
  guestName: string;
  guestEmail: string | null;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function GuestInviteToEventDialog({
  open,
  onOpenChange,
  guestId,
  guestName,
  guestEmail,
}: Props) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventId, setEventId] = useState<string>("");
  const [payer, setPayer] = useState<"guest" | "inviter">("guest");
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<{
    url: string;
    emailSent: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setGenerated(null);
    setLoading(true);
    fetch("/api/events?upcoming=true&with_policy=true")
      .then((res) => res.json())
      .then((data) => {
        const list: EventOption[] = (Array.isArray(data) ? data : data.events ?? [])
          .filter(
            (event: EventOption) =>
              event.guest_policy && event.guest_policy !== "closed"
          )
          .filter(
            (event: EventOption) =>
              new Date(event.event_date).getTime() >= Date.now() - 86400000
          )
          .sort(
            (a: EventOption, b: EventOption) =>
              new Date(a.event_date).getTime() -
              new Date(b.event_date).getTime()
          );
        setEvents(list);
        if (list.length > 0) setEventId(list[0].id);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [open]);

  const selected = useMemo(
    () => events.find((event) => event.id === eventId),
    [events, eventId]
  );

  async function handleSubmit() {
    setError(null);
    setGenerated(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/guests/${guestId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          payer,
          send_email: sendEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not invite this guest.");
      }
      setGenerated({ url: data.url, emailSent: Boolean(data.email_sent) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite {guestName}</DialogTitle>
          <DialogDescription>
            Generate a private invitation link for an upcoming event. We will
            link it to this guest&apos;s record so attendance shows in their
            history.
          </DialogDescription>
        </DialogHeader>

        {generated ? (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">
              Invitation generated.
              {generated.emailSent
                ? " We have emailed the link to the guest."
                : guestEmail
                  ? " Email was not sent (check Resend config or unticked above)."
                  : " Add an email to the guest to send it automatically."}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-blue-900">
                {generated.url}
              </code>
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => copy(generated.url)}
              >
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setGenerated(null)}
            >
              Invite to another event
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="event_id">Event</Label>
              {loading ? (
                <p className="text-sm text-dash-muted">Loading events...</p>
              ) : events.length === 0 ? (
                <p className="text-sm text-dash-muted">
                  No upcoming events accept guests. Set a guest policy on an
                  event first.
                </p>
              ) : (
                <select
                  id="event_id"
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text focus:outline-none focus:ring-2 focus:ring-dash-ring"
                >
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {formatDate(event.event_date)}{" "}
                      {event.guest_policy === "blue_table"
                        ? "(members only)"
                        : "(Open guests)"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <fieldset className="space-y-2">
              <Label>Who pays the dining and service fees?</Label>
              <div className="flex flex-col gap-2 text-sm text-dash-text">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payer"
                    checked={payer === "guest"}
                    onChange={() => setPayer("guest")}
                  />
                  The guest pays through their church-branded guest link
                  (default)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payer"
                    checked={payer === "inviter"}
                    onChange={() => setPayer("inviter")}
                  />
                  The church will cover the fees (no payment screen)
                </label>
              </div>
            </fieldset>

            <label className="flex items-start gap-2 text-sm text-dash-text">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-dash-border text-blue-600"
                disabled={!guestEmail}
              />
              <span>
                Email the invitation to{" "}
                <span className="font-medium">
                  {guestEmail ?? "(no email on file)"}
                </span>{" "}
                automatically.
              </span>
            </label>

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
          </div>
        )}

        {!generated ? (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || !eventId || events.length === 0}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {submitting
                ? "Generating..."
                : sendEmail && guestEmail
                  ? "Generate & email"
                  : "Generate link"}
            </Button>
          </DialogFooter>
        ) : null}

        {selected ? (
          <p className="border-t border-dash-border pt-3 text-xs text-dash-muted">
            {selected.title} - {formatDate(selected.event_date)} -{" "}
            {selected.guest_policy === "blue_table"
              ? "Blue table (members only)"
              : "White table (open guests)"}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
