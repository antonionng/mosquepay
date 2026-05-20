"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  UserPlus,
  Copy,
  Calendar,
  Users,
  Ban,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Invitation = {
  id: string;
  event_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  payer: "guest" | "inviter";
  uses: number;
  max_uses: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
};

type EventLite = {
  id: string;
  title: string;
  event_date: string;
  guest_policy?: "blue_table" | "white_table" | "closed";
};

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusForInvitation(inv: Invitation) {
  if (inv.revoked_at) return { label: "Revoked", variant: "destructive" as const };
  if (inv.expires_at && new Date(inv.expires_at) < new Date())
    return { label: "Expired", variant: "secondary" as const };
  if (inv.max_uses && inv.uses >= inv.max_uses)
    return { label: "Used", variant: "success" as const };
  return { label: "Active", variant: "default" as const };
}

export default function MemberGuestsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/member/guests");
        const data = await res.json();
        if (!active) return;
        setInvitations(data.invitations ?? []);
        setEvents(data.events ?? []);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const eventMap = new Map(events.map((event) => [event.id, event]));
  const upcomingEvents = events
    .filter(
      (event) =>
        event.guest_policy &&
        event.guest_policy !== "closed" &&
        new Date(event.event_date).getTime() >= Date.now() - 86400000
    )
    .sort(
      (a, b) =>
        new Date(a.event_date).getTime() - new Date(b.event_date).getTime()
    );

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">My guests</h1>
        <p className="mt-1 text-sm text-slate-500">
          Invite a brother or visitor to a lodge event. Choose whether your
          guest pays for their own dining and meeting fees or you cover them,
          and keep an audit trail of every link you have shared.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Upcoming events open to guests
        </h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
            Loading...
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            No upcoming events accept guests right now. Check back soon.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                href="/member/events"
                className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-blue-700">
                    {event.title}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(event.event_date)}
                    {event.guest_policy === "blue_table" ? (
                      <Badge variant="default" className="ml-2">
                        Masons only
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">
                        Open guests
                      </Badge>
                    )}
                  </p>
                </div>
                <Button size="sm" variant="primary">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Invite
                </Button>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Your guest links ({invitations.length})
        </h2>
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-400">
            Loading...
          </div>
        ) : invitations.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
              <Users className="h-6 w-6 text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              You have not invited any guests yet.
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Open an event from the events page and tap{" "}
              <span className="font-medium">Invite a guest</span> to share a
              private link.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Event</th>
                  <th className="px-4 py-3 text-left font-medium">Recipient</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invitations.map((inv) => {
                  const event = eventMap.get(inv.event_id);
                  const status = statusForInvitation(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/40">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {event?.title ?? "(event)"}
                        </p>
                        {event?.event_date ? (
                          <p className="text-xs text-slate-500">
                            {formatDate(event.event_date)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {inv.recipient_name || inv.recipient_email || "Open"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {inv.uses > 0 ? (
                          <span className="ml-2 text-xs text-emerald-600">
                            <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
                            {inv.uses} use{inv.uses === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(inv.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!inv.revoked_at ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  copy(
                                    `${window.location.origin}/g/(see admin)`
                                  )
                                }
                                title="Copy link"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              {event ? (
                                <Link href={`/member/events`}>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  if (!confirm("Revoke this guest link?"))
                                    return;
                                  await fetch(
                                    `/api/member/events/${inv.event_id}/guest-invitations?invitation_id=${inv.id}`,
                                    { method: "DELETE" }
                                  );
                                  setInvitations((prev) =>
                                    prev.map((p) =>
                                      p.id === inv.id
                                        ? {
                                            ...p,
                                            revoked_at: new Date().toISOString(),
                                          }
                                        : p
                                    )
                                  );
                                }}
                              >
                                <Ban className="mr-1 h-3.5 w-3.5" />
                                Revoke
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
