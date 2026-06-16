import Link from "next/link";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Utensils,
  StickyNote,
  Calendar,
} from "lucide-react";
import { GuestProfileActions } from "@/components/admin/guest-profile-actions";

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminGuestProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();

  const guest =
    ctx.mode === "mock"
      ? mockDb.getGuestById(id) ?? null
      : ctx.mosqueId
        ? await db.getGuestById(id, ctx.mosqueId)
        : null;

  if (!guest) {
    notFound();
  }

  const eventGuests =
    ctx.mode === "mock"
      ? mockDb.listEventGuestsForMosque({ guestId: id })
      : ctx.mosqueId
        ? await db.listEventGuestsForMosque(ctx.mosqueId, { guestId: id })
        : [];

  const eventIds = Array.from(
    new Set(eventGuests.map((eg) => eg.event_id))
  ).filter(Boolean) as string[];

  const eventMap = new Map<
    string,
    { id: string; title: string; event_date: string }
  >();
  if (ctx.mode === "mock") {
    for (const eid of eventIds) {
      const event = mockDb.getEventById(eid);
      if (event) {
        eventMap.set(eid, {
          id: event.id,
          title: event.title,
          event_date: event.event_date,
        });
      }
    }
  } else if (ctx.mosqueId) {
    await Promise.all(
      eventIds.map(async (eid) => {
        const event = await db.getEventById(eid, ctx.mosqueId!);
        if (event) {
          eventMap.set(eid, {
            id: event.id,
            title: event.title,
            event_date: event.event_date,
          });
        }
      })
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link
          href="/admin/guests"
          className="inline-flex items-center gap-1.5 text-sm text-dash-muted hover:text-dash-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to guests
        </Link>
      </div>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">{guest.full_name}</h1>
          <p className="admin-page-copy">
            {guest.guest_category === "honorary_guest"
              ? "Honorary guest"
              : guest.is_member
                ? "Newcomer member"
                : "Guest"}
            {guest.dining_waived
              ? " · dines complimentary"
              : guest.guest_dining_amount != null
                ? ` · dining £${guest.guest_dining_amount}`
                : ""}
            {guest.mother_mosque_name
              ? ` - ${guest.mother_mosque_name}${
                  guest.mother_mosque_number
                    ? ` No. ${guest.mother_mosque_number}`
                    : ""
                }`
              : ""}
            {guest.archived_at ? " - archived" : ""}
          </p>
        </div>
        <GuestProfileActions
          guestId={guest.id}
          guestName={guest.full_name}
          guestEmail={guest.email}
          visitCount={guest.visit_count}
          archivedAt={guest.archived_at}
          hasNewcomerToken={Boolean(guest.newcomer_token_hash)}
          initialValues={{
            full_name: guest.full_name,
            email: guest.email ?? "",
            phone: guest.phone ?? "",
            mother_mosque_name: guest.mother_mosque_name ?? "",
            mother_mosque_number: guest.mother_mosque_number ?? "",
            constitution: guest.constitution ?? "",
            rank: guest.rank ?? "",
            dietary_requirements: guest.dietary_requirements ?? "",
            guest_category: guest.guest_category ?? "guest",
            guest_dining_amount: guest.guest_dining_amount?.toString() ?? "",
            dining_waived: guest.dining_waived ?? false,
            gift_aid_consent_status:
              "gift_aid_consent_status" in guest
                ? guest.gift_aid_consent_status
                : "unknown",
            is_member: guest.is_member,
            notes: guest.notes ?? "",
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 p-5">
          <h2 className="text-sm font-semibold text-dash-text">
            Contact details
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-dash-muted" />
              <div>
                <dt className="text-xs uppercase tracking-wider text-dash-muted">
                  Email
                </dt>
                <dd className="text-dash-text">{guest.email ?? "-"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Phone className="mt-0.5 h-4 w-4 text-dash-muted" />
              <div>
                <dt className="text-xs uppercase tracking-wider text-dash-muted">
                  Phone
                </dt>
                <dd className="text-dash-text">{guest.phone ?? "-"}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 text-dash-muted" />
              <div>
                <dt className="text-xs uppercase tracking-wider text-dash-muted">
                  Mother mosque
                </dt>
                <dd className="text-dash-text">
                  {guest.mother_mosque_name ?? "-"}
                  {guest.mother_mosque_number
                    ? ` No. ${guest.mother_mosque_number}`
                    : ""}
                </dd>
                {guest.constitution ? (
                  <p className="text-xs text-dash-muted">
                    {guest.constitution}
                  </p>
                ) : null}
                {guest.rank ? (
                  <p className="text-xs text-dash-muted">{guest.rank}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Utensils className="mt-0.5 h-4 w-4 text-dash-muted" />
              <div>
                <dt className="text-xs uppercase tracking-wider text-dash-muted">
                  Dietary
                </dt>
                <dd className="text-dash-text">
                  {guest.dietary_requirements ?? "None recorded"}
                </dd>
              </div>
            </div>
            {guest.notes ? (
              <div className="flex items-start gap-2">
                <StickyNote className="mt-0.5 h-4 w-4 text-dash-muted" />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-dash-muted">
                    Notes
                  </dt>
                  <dd className="text-dash-text whitespace-pre-wrap">
                    {guest.notes}
                  </dd>
                </div>
              </div>
            ) : null}
          </dl>
        </Card>

        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-dash-text">
              Visit history ({eventGuests.length})
            </h2>
          </div>
          {eventGuests.length === 0 ? (
            <p className="mt-4 text-sm text-dash-muted">
              No visits recorded yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-dash-border">
              {eventGuests.map((eg) => {
                const event = eventMap.get(eg.event_id);
                return (
                  <li
                    key={eg.id}
                    className="flex items-start justify-between gap-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-dash-text">
                        {event ? (
                          <Link
                            href={`/admin/services/${event.id}`}
                            className="hover:text-dash-ring"
                          >
                            {event.title}
                          </Link>
                        ) : (
                          eg.guest_name
                        )}
                      </p>
                      <p className="text-xs text-dash-muted">
                        {event
                          ? formatDateTime(event.event_date)
                          : formatDateTime(eg.created_at)}
                      </p>
                      {eg.dietary_requirements ? (
                        <p className="text-xs text-dash-muted">
                          Dietary: {eg.dietary_requirements}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-dash-muted">
                      <p className="capitalize">
                        {(eg.source ?? "member_party").replace(/_/g, " ")}
                      </p>
                      <p>{formatDateTime(eg.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6 flex items-center gap-2 text-xs text-dash-muted">
            <Calendar className="h-3.5 w-3.5" />
            Visit count: {guest.visit_count}
          </div>
        </Card>
      </div>

      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/guests">Back to guests</Link>
        </Button>
      </div>
    </div>
  );
}
