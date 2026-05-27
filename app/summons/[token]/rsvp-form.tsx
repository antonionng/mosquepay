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
  enableCharityDonation: boolean;
  charityName: string | null;
  charityDescription: string | null;
  charitySuggestedAmounts: number[] | null;
  charityAllowCustom: boolean;
  enableRaffleDonation: boolean;
  raffleDescription: string | null;
  raffleSuggestedAmounts: number[] | null;
  raffleAllowCustom: boolean;
  enableRaffleWinePledge: boolean;
  raffleWineDescription: string | null;
  memberProfile?: MemberFeeProfile | null;
  feeDefaults?: LodgeFeeDefaults | null;
  initial: {
    attending_ceremony: boolean;
    attending_dining: boolean;
    dietary_requirements: string;
    special_requests: string;
    raffle_wine_pledged: boolean;
    raffle_wine_bottles: number;
    raffle_wine_note: string;
  };
};

function formatGbp(value: number): string {
  return Number.isInteger(value) ? `£${value}` : `£${value.toFixed(2)}`;
}

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
  // meetingFeeDescription is part of the prop interface but the breakdown
  // component renders the canonical label from buildMemberFeeBreakdown, so
  // we don't read it here. Intentionally unused.
  enableGuestTickets,
  guestTicketPrice,
  guestTicketDescription,
  enableCharityDonation,
  charityName,
  charityDescription,
  charitySuggestedAmounts,
  charityAllowCustom,
  enableRaffleDonation,
  raffleDescription,
  raffleSuggestedAmounts,
  raffleAllowCustom,
  enableRaffleWinePledge,
  raffleWineDescription,
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

  const [charityAmount, setCharityAmount] = useState<number>(0);
  const [charityCustom, setCharityCustom] = useState<string>("");
  const [raffleAmount, setRaffleAmount] = useState<number>(0);
  const [raffleCustom, setRaffleCustom] = useState<string>("");

  const [winePledged, setWinePledged] = useState(initial.raffle_wine_pledged);
  const [wineBottles, setWineBottles] = useState<number>(
    Math.max(initial.raffle_wine_bottles, 1)
  );
  const [wineNote, setWineNote] = useState(initial.raffle_wine_note);

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

  // Contributions live alongside compulsory charges, but only when the
  // member has actually entered an amount. We use feeBreakdown.items as the
  // basis for the existing UI and append extra rows for charity / raffle so
  // the breakdown component shows a unified summary at the bottom.
  const breakdownItems = useMemo(() => {
    const items = [...feeBreakdown.items];
    if (enableCharityDonation && charityAmount > 0) {
      items.push({
        key: "charity",
        label: charityName ? `Charity donation: ${charityName}` : "Charity donation",
        amount: charityAmount,
      });
    }
    if (enableRaffleDonation && raffleAmount > 0) {
      items.push({
        key: "raffle",
        label: "Raffle contribution",
        amount: raffleAmount,
      });
    }
    return items;
  }, [
    feeBreakdown.items,
    enableCharityDonation,
    charityAmount,
    charityName,
    enableRaffleDonation,
    raffleAmount,
  ]);

  const total = breakdownItems.reduce((s, i) => s + i.amount, 0);
  const compulsoryTotal = feeBreakdown.total;
  const requiresPayment = enablePayments && total > 0;

  // Wine pledge is a non-cash side effect of attending. We always send it
  // in the RSVP payload (even on apologies — the brother may want to drop
  // a bottle off in advance). When attending+paying, we route through
  // checkout first and save the pledge on the resulting RSVP via the
  // payment webhook's RSVP confirmation path, BUT the checkout route
  // doesn't currently carry pledge fields, so we save the RSVP first via
  // the access endpoint and then continue to checkout. See submit() below.
  const showWinePledge = enableRaffleWinePledge;

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

  function selectCharity(amount: number) {
    setCharityAmount(amount);
    setCharityCustom("");
  }

  function selectRaffle(amount: number) {
    setRaffleAmount(amount);
    setRaffleCustom("");
  }

  function setCharityCustomAmount(raw: string) {
    setCharityCustom(raw);
    const n = Number(raw);
    setCharityAmount(Number.isFinite(n) && n > 0 ? n : 0);
  }

  function setRaffleCustomAmount(raw: string) {
    setRaffleCustom(raw);
    const n = Number(raw);
    setRaffleAmount(Number.isFinite(n) && n > 0 ? n : 0);
  }

  async function submit() {
    if (attending && guests.some((guest) => !guest.guest_name.trim())) {
      setError("Please provide a name for each guest.");
      return;
    }

    setPending(true);
    setError(null);
    setSaved(false);

    // Wine pledge payload is shared between both branches below. The
    // checkout-session route will write it onto the freshly-created RSVP
    // before it hands off to Mooov; the access route writes it directly.
    const winePayload =
      showWinePledge && attending
        ? {
            raffle_wine_pledged: winePledged,
            raffle_wine_bottles: winePledged ? Math.max(1, wineBottles) : 0,
            raffle_wine_note: winePledged ? wineNote.trim() || null : null,
          }
        : {
            raffle_wine_pledged: false,
            raffle_wine_bottles: 0,
            raffle_wine_note: null,
          };

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
              charity_amount: charityAmount,
              raffle_amount: raffleAmount,
              gift_aid: false,
              gift_aid_address_line_1: "",
              gift_aid_address_line_2: "",
              gift_aid_city: "",
              gift_aid_postcode: "",
              ...winePayload,
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
            ...winePayload,
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

  const charityChips = charitySuggestedAmounts ?? [];
  const raffleChips = raffleSuggestedAmounts ?? [];

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

      {attending &&
      (enableCharityDonation ||
        enableRaffleDonation ||
        showWinePledge) ? (
        <div className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            Optional contributions
          </p>

          {enableCharityDonation ? (
            <div className="space-y-2">
              <Label className="font-semibold text-slate-950">
                Charity donation{charityName ? ` (${charityName})` : ""}
              </Label>
              {charityDescription ? (
                <p className="text-xs text-slate-600">{charityDescription}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectCharity(0)}
                  className={
                    charityAmount === 0 && !charityCustom
                      ? "rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  }
                >
                  None
                </button>
                {charityChips.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => selectCharity(amount)}
                    className={
                      charityAmount === amount && !charityCustom
                        ? "rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm"
                        : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    }
                  >
                    {formatGbp(amount)}
                  </button>
                ))}
                {charityAllowCustom ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600">£</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Custom"
                      value={charityCustom}
                      onChange={(event) =>
                        setCharityCustomAmount(event.target.value)
                      }
                      className="h-8 w-24 text-xs"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {enableRaffleDonation ? (
            <div className="space-y-2">
              <Label className="font-semibold text-slate-950">
                Raffle contribution
              </Label>
              {raffleDescription ? (
                <p className="text-xs text-slate-600">{raffleDescription}</p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectRaffle(0)}
                  className={
                    raffleAmount === 0 && !raffleCustom
                      ? "rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm"
                      : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                  }
                >
                  None
                </button>
                {raffleChips.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => selectRaffle(amount)}
                    className={
                      raffleAmount === amount && !raffleCustom
                        ? "rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm"
                        : "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    }
                  >
                    {formatGbp(amount)}
                  </button>
                ))}
                {raffleAllowCustom ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-600">£</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Custom"
                      value={raffleCustom}
                      onChange={(event) =>
                        setRaffleCustomAmount(event.target.value)
                      }
                      className="h-8 w-24 text-xs"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {showWinePledge ? (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={winePledged}
                  onChange={(event) => setWinePledged(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                <span>
                  <span className="block font-semibold text-slate-950">
                    Pledge a bottle for the wine raffle
                  </span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {raffleWineDescription ??
                      "Bring a bottle of wine for the evening raffle."}{" "}
                    No payment is taken — the bottle is the donation. Please
                    bring it on the night.
                  </span>
                </span>
              </label>
              {winePledged ? (
                <div className="grid gap-3 sm:grid-cols-[120px_1fr]">
                  <div className="space-y-1">
                    <Label htmlFor="wine_bottles">Bottles</Label>
                    <Input
                      id="wine_bottles"
                      type="number"
                      min={1}
                      max={20}
                      value={wineBottles}
                      onChange={(event) =>
                        setWineBottles(
                          Math.max(
                            1,
                            Math.min(20, Number(event.target.value) || 1)
                          )
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="wine_note">
                      What you&apos;ll bring (optional)
                    </Label>
                    <Input
                      id="wine_note"
                      placeholder="e.g. Chianti Riserva 2019"
                      value={wineNote}
                      onChange={(event) => setWineNote(event.target.value)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {saved ? (
        <p className="text-sm font-medium text-emerald-700">
          RSVP saved. Thank you.
        </p>
      ) : null}

      {attending && (requiresPayment || compulsoryTotal > 0) ? (
        <FeeBreakdown items={breakdownItems} total={total} />
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
