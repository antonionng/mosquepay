"use client";

import { useEffect, useState } from "react";
import { Copy, Link as LinkIcon, RefreshCcw, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GuestPolicy = "blue_table" | "white_table" | "closed";

type Invitation = {
  id: string;
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

type EventGuestRow = {
  id: string;
  guest_name: string;
  email: string | null;
  dietary_requirements: string | null;
  source: "member_party" | "self_invite" | "admin_added";
  created_at: string;
};

type Props = {
  eventId: string;
  eventTitle: string;
  guestPolicy: GuestPolicy;
};

function formatPolicy(p: GuestPolicy) {
  if (p === "blue_table") return "Blue table (Masons only)";
  if (p === "white_table") return "White table (open to guests)";
  return "Closed (no guest links)";
}

function formatRelative(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function EventGuestsPanel({
  eventId,
  eventTitle,
  guestPolicy,
}: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [eventGuests, setEventGuests] = useState<EventGuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [invRes, guestsRes] = await Promise.all([
        fetch(`/api/admin/events/${eventId}/guest-invitations`),
        fetch(`/api/admin/events/${eventId}/guests`),
      ]);
      if (invRes.ok) {
        const data = await invRes.json();
        setInvitations(Array.isArray(data.invitations) ? data.invitations : []);
      }
      if (guestsRes.ok) {
        const data = await guestsRes.json();
        setEventGuests(Array.isArray(data.guests) ? data.guests : []);
      }
    } catch {
      setError("Could not load guests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function createInvitation() {
    setError(null);
    setCreating(true);
    setLatestUrl(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/guest-invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_name: recipientName.trim() || null,
          recipient_email: recipientEmail.trim() || null,
          payer: "guest",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not generate link.");
      }
      setLatestUrl(body.url ?? null);
      setRecipientName("");
      setRecipientEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function revokeInvitation(id: string) {
    if (!confirm("Revoke this guest link? Anyone holding it will lose access.")) return;
    try {
      const res = await fetch(
        `/api/admin/events/${eventId}/guest-invitations/${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Could not revoke.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
  }

  const policyClosed = guestPolicy === "closed";

  return (
    <div className="space-y-6">
      <div className="admin-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">
              Guest links
            </h2>
            <p className="mt-1 text-sm text-dash-muted">
              Generate a private link to invite a guest to {eventTitle}. Links
              are unguessable, unlimited use by default, and can be revoked.
            </p>
          </div>
          <span className="rounded-full border border-dash-border bg-dash-surface-subtle px-3 py-1 text-xs font-medium text-dash-text">
            {formatPolicy(guestPolicy)}
          </span>
        </div>

        {policyClosed ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This event&apos;s guest policy is set to closed. Change it on the event
            details below to enable guest links.
          </p>
        ) : (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recipient_name">Recipient name (optional)</Label>
                <Input
                  id="recipient_name"
                  value={recipientName}
                  onChange={(event) => setRecipientName(event.target.value)}
                  placeholder="e.g. W. Bro John Smith"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipient_email">Recipient email (optional)</Label>
                <Input
                  id="recipient_email"
                  type="email"
                  value={recipientEmail}
                  onChange={(event) => setRecipientEmail(event.target.value)}
                  placeholder="brother@example.com"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={createInvitation}
                disabled={creating}
                variant="primary"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                {creating ? "Generating..." : "Generate guest link"}
              </Button>
              <Button
                type="button"
                onClick={() => void load()}
                variant="secondary"
                size="sm"
              >
                <RefreshCcw className="mr-1 h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>

            {latestUrl ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm">
                <p className="font-medium text-blue-900">
                  Guest link ready. Share it however you like.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-blue-900">
                    {latestUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => copy(latestUrl)}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-dash-text">Active links</h3>
              {loading ? (
                <p className="mt-3 text-sm text-dash-muted">Loading...</p>
              ) : invitations.length === 0 ? (
                <p className="mt-3 text-sm text-dash-muted">
                  No links yet. Generate one above.
                </p>
              ) : (
                <div className="admin-table-shell mt-3">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Recipient</th>
                        <th>Created</th>
                        <th>Last used</th>
                        <th>Uses</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((inv) => {
                        const status = inv.revoked_at
                          ? "Revoked"
                          : inv.expires_at && new Date(inv.expires_at) < new Date()
                            ? "Expired"
                            : inv.max_uses != null && inv.uses >= inv.max_uses
                              ? "Used up"
                              : "Active";
                        return (
                          <tr key={inv.id}>
                            <td>
                              <div className="font-medium text-dash-text">
                                {inv.recipient_name ?? "Unnamed"}
                              </div>
                              {inv.recipient_email ? (
                                <div className="text-xs text-dash-muted">
                                  {inv.recipient_email}
                                </div>
                              ) : null}
                            </td>
                            <td className="text-sm text-dash-muted">
                              {formatRelative(inv.created_at)}
                            </td>
                            <td className="text-sm text-dash-muted">
                              {formatRelative(inv.last_used_at)}
                            </td>
                            <td className="text-sm text-dash-text">
                              {inv.uses}
                              {inv.max_uses != null ? ` / ${inv.max_uses}` : ""}
                            </td>
                            <td>
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                  status === "Active"
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {status}
                              </span>
                            </td>
                            <td className="text-right">
                              {status === "Active" ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => revokeInvitation(inv.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="admin-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dash-text">Guests attending</h2>
          <span className="text-sm text-dash-muted">
            {eventGuests.length} total
          </span>
        </div>
        {eventGuests.length === 0 ? (
          <p className="mt-4 text-sm text-dash-muted">
            No guests have registered for this event yet.
          </p>
        ) : (
          <div className="admin-table-shell mt-4">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Dietary</th>
                  <th>Source</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {eventGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td className="font-medium text-dash-text">{guest.guest_name}</td>
                    <td className="text-sm text-dash-muted">
                      {guest.email ?? "-"}
                    </td>
                    <td className="text-sm text-dash-muted">
                      {guest.dietary_requirements ?? "-"}
                    </td>
                    <td className="text-sm text-dash-muted">
                      {guest.source === "self_invite"
                        ? "Self-invited"
                        : guest.source === "admin_added"
                          ? "Admin"
                          : "Member's party"}
                    </td>
                    <td className="text-sm text-dash-muted">
                      {formatRelative(guest.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 text-right">
              <a
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                href={`/api/admin/events/${eventId}/guests?format=csv`}
              >
                <LinkIcon className="h-3.5 w-3.5" />
                Download as CSV
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
