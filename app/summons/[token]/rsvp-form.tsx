"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { FeeBreakdown } from "@/components/fees/fee-breakdown";
import {
  buildMemberFeeBreakdown,
  type MemberFeeProfile,
  type LodgeFeeDefaults,
} from "@/lib/fees/resolve";

type GuestEntry = {
  guest_name: string;
  dietary_requirements: string;
};

type Props = {
  token: string;
  eventId: string;
  lodgeSlug: string;
  recipientName: string;
  recipientEmail: string;
  enableDining: boolean;
  diningPrice: number | null;
  diningDescription: string | null;
  enablePayments: boolean;
  enableMeetingFee: boolean;
  meetingFeeAmount: number | null;
  meetingFeeDescription: string | null;
  enableGuestTickets: boolean;
  guestTicketPrice: number | null;
  guestTicketDescription: string | null;
  memberProfile?: MemberFeeProfile | null;
  feeDefaults?: LodgeFeeDefaults | null;
  initial: {
    attending_ceremony: boolean;
    attending_dining: boolean;
    dietary_requirements: string;
    special_requests: string;
  };
};

export function SummonsRsvpForm({
  token,
  eventId,
  lodgeSlug,
  recipientName,
  recipientEmail,
  enableDining,
  diningPrice,
  diningDescription,
  enablePayments,
  enableMeetingFee,
  meetingFeeAmount,
  meetingFeeDescription,
  enableGuestTickets,
  guestTicketPrice,
  guestTicketDescription,
  memberProfile,
  feeDefaults,
  initial,
}: Props) {
  const [attending, setAttending] = useState(initial.attending_ceremony);
  const [dining, setDining] = useState(initial.attending_dining);
  const [dietary, setDietary] = useState(initial.dietary_requirements);
  const [notes, setNotes] = useState(initial.special_requests);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventCtx = {
    enable_meeting_fee: enableMeetingFee,
    meeting_fee_amount: meetingFeeAmount,
    enable_dining_rsvp: enableDining,
    dining_price: diningPrice,
    enable_guest_tickets: enableGuestTickets,
    guest_ticket_price: guestTicketPrice,
  };

  const feeBreakdown = useMemo(
    () =>
      buildMemberFeeBreakdown({
        member: memberProfile,
        event: eventCtx,
        defaults: feeDefaults ?? null,
        attendingCeremony: attending,
        attendingDining: attending && dining,
        guests: guests
          .filter((g) => g.guest_name.trim())
          .map((g) => ({
            name: g.guest_name.trim(),
            profile: null,
          })),
      }),
    [
      attending,
      dining,
      diningPrice,
      enableDining,
      enableGuestTickets,
      enableMeetingFee,
      feeDefaults,
      guestTicketPrice,
      guests,
      meetingFeeAmount,
      memberProfile,
    ]
  );

  const meetingFee = feeBreakdown.items.find((i) => i.key === "levy")?.amount ?? 0;
  const diningTotal = feeBreakdown.items.find((i) => i.key === "dining")?.amount ?? 0;
  const guestTotal = feeBreakdown.items
    .filter((i) => i.key.startsWith("guest:"))
    .reduce((s, i) => s + i.amount, 0);
  const total = feeBreakdown.total;
  const requiresPayment = enablePayments && total > 0;

  function addGuest() {
    if (guests.length >= 10) return;
    setGuests([...guests, { guest_name: "", dietary_requirements: "" }]);
  }

  function removeGuest(index: number) {
    setGuests(guests.filter((_, i) => i !== index));
  }

  function updateGuest(index: number, patch: Partial<GuestEntry>) {
    setGuests(
      guests.map((guest, i) => (i === index ? { ...guest, ...patch } : guest))
    );
  }

  async function submit() {
    if (attending && guests.some((guest) => !guest.guest_name.trim())) {
      setError("Please provide a name for each guest.");
      return;
    }

    setPending(true);
    setError(null);
    setSaved(false);
    try {
      if (attending && requiresPayment) {
        const lodgeQuery = lodgeSlug
          ? `?lodge=${encodeURIComponent(lodgeSlug)}`
          : "";
        const res = await fetch(
          `/api/payments/create-checkout-session${lodgeQuery}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event_id: eventId,
              user_name: recipientName,
              user_email: recipientEmail,
              user_phone: null,
              attending_ceremony: true,
              attending_dining: enableDining ? dining : false,
              number_of_guests: guests.length,
              dietary_requirements: dietary,
              special_requests: notes,
              dining_total: diningTotal,
              meeting_fee: meetingFee,
              guest_total: guestTotal,
              guests,
              charity_amount: 0,
              raffle_amount: 0,
              gift_aid: false,
              gift_aid_address_line_1: "",
              gift_aid_address_line_2: "",
              gift_aid_city: "",
              gift_aid_postcode: "",
            }),
          }
        );
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error ?? "Could not start checkout.");
        }
        if (body?.url) {
          window.location.href = body.url as string;
          return;
        }
        throw new Error("No checkout URL returned.");
      }

      const res = await fetch(
        `/api/summons/access/${encodeURIComponent(token)}/rsvp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attending_ceremony: attending,
            attending_dining: attending && enableDining ? dining : false,
            number_of_guests: attending ? guests.length : 0,
            guests: attending ? guests : [],
            dietary_requirements: dietary,
            special_requests: notes,
          }),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not save your RSVP.");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAttending(true)}
          className={
            attending
              ? "rounded-xl border border-blue-600 bg-white px-4 py-3 text-left text-sm font-semibold text-blue-700 shadow-sm"
              : "rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700"
          }
        >
          I will attend
        </button>
        <button
          type="button"
          onClick={() => {
            setAttending(false);
            setDining(false);
          }}
          className={
            !attending
              ? "rounded-xl border border-blue-600 bg-white px-4 py-3 text-left text-sm font-semibold text-blue-700 shadow-sm"
              : "rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700"
          }
        >
          Send apologies
        </button>
      </div>

      {attending && enableDining ? (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <input
            type="checkbox"
            checked={dining}
            onChange={(event) => setDining(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
          />
          <span>
            <span className="block font-semibold text-slate-950">
              Attending dining
            </span>
            {diningDescription ? (
              <span className="mt-1 block text-slate-600">
                {diningDescription}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}

      {attending ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">Guests</p>
              <p className="mt-1 text-xs text-slate-600">
                {enableGuestTickets && guestTicketPrice != null
                  ? guestTicketDescription ??
                    `£${guestTicketPrice.toFixed(2)} per guest`
                  : "Add a guest if you are bringing someone with you."}
              </p>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={addGuest}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add guest
            </Button>
          </div>

          {guests.length > 0 ? (
            <div className="mt-4 space-y-3">
              {guests.map((guest, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`guest_${index}_name`}>Guest name</Label>
                    <Input
                      id={`guest_${index}_name`}
                      value={guest.guest_name}
                      onChange={(event) =>
                        updateGuest(index, { guest_name: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`guest_${index}_dietary`}>Dietary</Label>
                    <Input
                      id={`guest_${index}_dietary`}
                      value={guest.dietary_requirements}
                      onChange={(event) =>
                        updateGuest(index, {
                          dietary_requirements: event.target.value,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeGuest(index)}
                    className="self-end text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="summons_dietary">
          Dietary requirements / accessibility
        </Label>
        <Textarea
          id="summons_dietary"
          rows={2}
          value={dietary}
          onChange={(event) => setDietary(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="summons_notes">
          {attending ? "Notes for the secretary" : "Reason / message"}
        </Label>
        <Textarea
          id="summons_notes"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saved ? (
        <p className="text-sm font-medium text-emerald-700">
          RSVP saved. Thank you.
        </p>
      ) : null}

      {attending && requiresPayment ? (
        <FeeBreakdown items={feeBreakdown.items} total={total} />
      ) : null}

      <Button type="button" variant="primary" onClick={submit} disabled={pending}>
        {pending
          ? requiresPayment
            ? "Opening checkout..."
            : "Saving..."
          : attending
            ? requiresPayment
              ? "Confirm and pay"
              : "Confirm attendance"
            : "Send apologies"}
      </Button>
    </div>
  );
}
