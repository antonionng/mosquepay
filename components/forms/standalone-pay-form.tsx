"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";

type GuestEntry = { guest_name: string; dietary_requirements: string };

type Props = {
  eventId: string;
  lodgeSlug?: string;
  enableDining: boolean;
  diningPrice: number | null;
  diningDescription: string | null;
  enableCharity: boolean;
  charityName: string | null;
  charitySuggestedAmounts: number[];
  charityAllowCustom: boolean;
  enableRaffle: boolean;
  raffleSuggestedAmounts: number[];
  raffleAllowCustom: boolean;
  enableMeetingFee: boolean;
  meetingFeeAmount: number | null;
  meetingFeeDescription: string | null;
  enableGuestTickets: boolean;
  guestTicketPrice: number | null;
  guestTicketDescription: string | null;
};

export function StandalonePayForm({
  eventId,
  lodgeSlug,
  enableDining,
  diningPrice,
  diningDescription,
  enableCharity,
  charityName,
  charitySuggestedAmounts,
  charityAllowCustom,
  enableRaffle,
  raffleSuggestedAmounts,
  raffleAllowCustom,
  enableMeetingFee,
  meetingFeeAmount,
  meetingFeeDescription,
  enableGuestTickets,
  guestTicketPrice,
  guestTicketDescription,
}: Props) {
  const searchParams = useSearchParams();
  const lodgeFromQuery = searchParams.get("lodge");
  const effectiveLodge = lodgeSlug ?? lodgeFromQuery ?? undefined;
  const lodgeQuery = effectiveLodge ? `?lodge=${encodeURIComponent(effectiveLodge)}` : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [includeDining, setIncludeDining] = useState(false);
  const [charityAmount, setCharityAmount] = useState(0);
  const [raffleAmount, setRaffleAmount] = useState(0);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const meetingFee = enableMeetingFee && meetingFeeAmount ? meetingFeeAmount : 0;
  const diningTotal = enableDining && diningPrice && includeDining ? diningPrice : 0;
  const guestTotal = enableGuestTickets && guestTicketPrice ? guests.length * guestTicketPrice : 0;
  const total = meetingFee + diningTotal + guestTotal + charityAmount + raffleAmount;

  function addGuest() {
    if (guests.length >= 10) return;
    setGuests([...guests, { guest_name: "", dietary_requirements: "" }]);
  }

  function removeGuest(i: number) {
    setGuests(guests.filter((_, idx) => idx !== i));
  }

  function updateGuest(i: number, field: keyof GuestEntry, value: string) {
    const updated = [...guests];
    updated[i] = { ...updated[i], [field]: value };
    setGuests(updated);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim()) {
      setError("Name and email are required.");
      return;
    }
    if (total <= 0) {
      setError("Please select at least one payment option.");
      return;
    }
    if (enableGuestTickets && guests.some((g) => !g.guest_name.trim())) {
      setError("Please provide a name for each guest.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/payments/create-checkout-session${lodgeQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          user_name: name.trim(),
          user_email: email.trim(),
          standalone: true,
          attending_dining: includeDining,
          dining_total: diningTotal,
          meeting_fee: meetingFee,
          guest_total: guestTotal,
          guests: enableGuestTickets ? guests : [],
          number_of_guests: guests.length,
          charity_amount: charityAmount,
          raffle_amount: raffleAmount,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Payment failed");
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="pay_name">Your name *</Label>
        <Input id="pay_name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pay_email">Email *</Label>
        <Input id="pay_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
        <h4 className="font-semibold text-slate-950">Select items</h4>

        {meetingFee > 0 && (
          <p className="text-sm">
            {meetingFeeDescription ?? "Meeting fee"}: £{meetingFee.toFixed(2)}
          </p>
        )}

        {enableDining && diningPrice != null && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="include_dining"
              checked={includeDining}
              onChange={(e) => setIncludeDining(e.target.checked)}
              className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="include_dining">
              Dining (£{diningPrice})
              {diningDescription ? ` — ${diningDescription}` : ""}
            </Label>
          </div>
        )}

        {enableGuestTickets && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-950">Guest tickets</p>
                {guestTicketDescription && (
                  <p className="text-xs text-muted-foreground">{guestTicketDescription}</p>
                )}
                {guestTicketPrice != null && (
                  <p className="text-xs text-muted-foreground">£{guestTicketPrice} per guest</p>
                )}
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addGuest} disabled={guests.length >= 10}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {guests.map((g, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder="Guest name *"
                    value={g.guest_name}
                    onChange={(e) => updateGuest(i, "guest_name", e.target.value)}
                  />
                  <Input
                    placeholder="Dietary requirements"
                    value={g.dietary_requirements}
                    onChange={(e) => updateGuest(i, "dietary_requirements", e.target.value)}
                  />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeGuest(i)} className="mt-1 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {enableCharity && (
          <div className="space-y-2">
            <Label>Charity donation {charityName && `(${charityName})`}</Label>
            <div className="flex flex-wrap gap-2">
              {charitySuggestedAmounts.map((a) => (
                <Button key={a} type="button" variant={charityAmount === a ? "default" : "secondary"} size="sm" onClick={() => setCharityAmount(a)}>
                  £{a}
                </Button>
              ))}
              {charityAllowCustom && (
                <Input type="number" min={0} step={1} placeholder="Custom" className="w-24" onChange={(e) => setCharityAmount(e.target.value ? Number(e.target.value) : 0)} />
              )}
            </div>
          </div>
        )}

        {enableRaffle && (
          <div className="space-y-2">
            <Label>Raffle contribution</Label>
            <div className="flex flex-wrap gap-2">
              {raffleSuggestedAmounts.map((a) => (
                <Button key={a} type="button" variant={raffleAmount === a ? "default" : "secondary"} size="sm" onClick={() => setRaffleAmount(a)}>
                  £{a}
                </Button>
              ))}
              {raffleAllowCustom && (
                <Input type="number" min={0} step={1} placeholder="Custom" className="w-24" onChange={(e) => setRaffleAmount(e.target.value ? Number(e.target.value) : 0)} />
              )}
            </div>
          </div>
        )}

        {total > 0 && (
          <p className="font-semibold text-slate-950">Total: £{total.toFixed(2)}</p>
        )}
      </div>

      <Button type="submit" disabled={submitting || total <= 0} variant="primary">
        {submitting ? "Redirecting..." : `Pay £${total.toFixed(2)}`}
      </Button>
    </form>
  );
}
