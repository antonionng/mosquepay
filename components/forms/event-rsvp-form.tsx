"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";

const guestSchema = z.object({
  guest_name: z.string().min(1, "Guest name is required"),
  dietary_requirements: z.string().optional(),
});

const schema = z
  .object({
    user_name: z.string().min(1, "Name is required"),
    user_email: z.string().email("Valid email is required"),
    user_phone: z.string().optional(),
    attending_ceremony: z.boolean().default(true),
    attending_dining: z.boolean().default(false),
    number_of_guests: z.coerce.number().min(0).max(10).default(0),
    dietary_requirements: z.string().optional(),
    special_requests: z.string().optional(),
    charity_amount: z.number().min(0).optional(),
    raffle_amount: z.number().min(0).optional(),
    gift_aid: z.boolean().default(false),
    gift_aid_confirmed: z.boolean().default(false),
    gift_aid_address_line_1: z.string().optional(),
    gift_aid_address_line_2: z.string().optional(),
    gift_aid_city: z.string().optional(),
    gift_aid_postcode: z.string().optional(),
    guests: z.array(guestSchema).default([]),
  })
  .refine(
    (d) =>
      !d.gift_aid ||
      (d.gift_aid_confirmed &&
        d.gift_aid_address_line_1 &&
        d.gift_aid_city &&
        d.gift_aid_postcode),
    {
      message:
        "Please confirm eligibility and provide your address to claim Gift Aid",
      path: ["gift_aid_confirmed"],
    }
  );

type FormData = z.infer<typeof schema>;
type GuestEntry = { guest_name: string; dietary_requirements?: string };

type EventRsvpFormProps = {
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
  hasPayments: boolean;
};

export function EventRsvpForm({
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
  hasPayments,
}: EventRsvpFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const searchParams = useSearchParams();
  const lodgeFromQuery = searchParams.get("lodge");
  const effectiveLodge = lodgeSlug ?? lodgeFromQuery ?? undefined;
  const lodgeQuery = effectiveLodge ? `?lodge=${encodeURIComponent(effectiveLodge)}` : "";

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      attending_ceremony: true,
      attending_dining: false,
      number_of_guests: 0,
      guests: [],
    },
  });

  const attendingDining = watch("attending_dining");
  const number_of_guests = watch("number_of_guests");
  const charityAmount = watch("charity_amount") ?? 0;
  const raffleAmount = watch("raffle_amount") ?? 0;
  const giftAid = watch("gift_aid");

  const diningTotal =
    enableDining && diningPrice != null && attendingDining
      ? diningPrice * (1 + (enableGuestTickets ? 0 : (number_of_guests ?? 0)))
      : 0;

  const meetingFee =
    enableMeetingFee && meetingFeeAmount != null ? meetingFeeAmount : 0;

  const guestTotal =
    enableGuestTickets && guestTicketPrice != null ? guests.length * guestTicketPrice : 0;

  const total = meetingFee + diningTotal + guestTotal + charityAmount + raffleAmount;

  function addGuest() {
    if (guests.length >= 10) return;
    const updated = [...guests, { guest_name: "", dietary_requirements: "" }];
    setGuests(updated);
    setValue("guests", updated);
    setValue("number_of_guests", updated.length);
  }

  function removeGuest(index: number) {
    const updated = guests.filter((_, i) => i !== index);
    setGuests(updated);
    setValue("guests", updated);
    setValue("number_of_guests", updated.length);
  }

  function updateGuest(index: number, field: keyof GuestEntry, value: string) {
    const updated = [...guests];
    updated[index] = { ...updated[index], [field]: value };
    setGuests(updated);
    setValue("guests", updated);
  }

  async function onSubmit(data: FormData) {
    setError(null);

    if (enableGuestTickets && guests.some((g) => !g.guest_name.trim())) {
      setError("Please provide a name for each guest.");
      return;
    }

    try {
      if (hasPayments && total > 0) {
        const res = await fetch(`/api/payments/create-checkout-session${lodgeQuery}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: eventId,
            ...data,
            dining_total: diningTotal,
            meeting_fee: meetingFee,
            guest_total: guestTotal,
            guests: enableGuestTickets ? guests : [],
            number_of_guests: enableGuestTickets ? guests.length : (data.number_of_guests ?? 0),
            charity_amount: data.charity_amount ?? 0,
            raffle_amount: data.raffle_amount ?? 0,
            gift_aid: data.gift_aid ?? false,
            gift_aid_address_line_1: data.gift_aid_address_line_1 ?? "",
            gift_aid_address_line_2: data.gift_aid_address_line_2 ?? "",
            gift_aid_city: data.gift_aid_city ?? "",
            gift_aid_postcode: data.gift_aid_postcode ?? "",
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Payment session failed");
        }
        const { url } = await res.json();
        if (url) window.location.href = url;
        return;
      }

      const res = await fetch(`/api/rsvps${lodgeQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          ...data,
          guests: enableGuestTickets ? guests : [],
          number_of_guests: enableGuestTickets ? guests.length : (data.number_of_guests ?? 0),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "RSVP failed");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.25rem] border border-blue-200 bg-blue-50 p-6 text-center">
        <p className="font-semibold text-slate-950">RSVP confirmed</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you. We look forward to seeing you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="user_name">Your name *</Label>
        <Input id="user_name" {...register("user_name")} />
        {errors.user_name && (
          <p className="text-sm text-destructive">{errors.user_name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="user_email">Email *</Label>
        <Input id="user_email" type="email" {...register("user_email")} />
        {errors.user_email && (
          <p className="text-sm text-destructive">{errors.user_email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="user_phone">Phone</Label>
        <Input id="user_phone" type="tel" {...register("user_phone")} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="attending_ceremony"
          {...register("attending_ceremony")}
          className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
        />
        <Label htmlFor="attending_ceremony">Attending ceremony</Label>
      </div>
      {enableDining && (
        <>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="attending_dining"
              {...register("attending_dining")}
              className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="attending_dining">
              Attending dining{diningPrice != null ? ` (£${diningPrice} per person)` : ""}
            </Label>
          </div>
          {diningDescription && (
            <p className="text-sm text-muted-foreground">{diningDescription}</p>
          )}
          {attendingDining && !enableGuestTickets && (
            <div className="space-y-2">
              <Label htmlFor="number_of_guests">Number of guests</Label>
              <Input
                id="number_of_guests"
                type="number"
                min={0}
                max={10}
                {...register("number_of_guests")}
              />
            </div>
          )}
        </>
      )}

      {enableGuestTickets && (
        <div className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-slate-950">Guests</h4>
              {guestTicketDescription && (
                <p className="text-sm text-muted-foreground">{guestTicketDescription}</p>
              )}
              {guestTicketPrice != null && (
                <p className="text-sm text-muted-foreground">£{guestTicketPrice} per guest</p>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addGuest}
              disabled={guests.length >= 10}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add guest
            </Button>
          </div>
          {guests.map((guest, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Guest name *"
                  value={guest.guest_name}
                  onChange={(e) => updateGuest(index, "guest_name", e.target.value)}
                />
                <Input
                  placeholder="Dietary requirements"
                  value={guest.dietary_requirements ?? ""}
                  onChange={(e) => updateGuest(index, "dietary_requirements", e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeGuest(index)}
                className="mt-1 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {guests.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No guests added yet. Click &ldquo;Add guest&rdquo; to bring someone along.
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="dietary_requirements">Dietary requirements</Label>
        <Input id="dietary_requirements" {...register("dietary_requirements")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="special_requests">Special requests</Label>
        <Textarea id="special_requests" {...register("special_requests")} rows={2} />
      </div>

      {hasPayments && (meetingFee > 0 || enableCharity || enableRaffle || (enableDining && attendingDining) || guestTotal > 0) && (
        <div className="space-y-4 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5">
          <h4 className="font-semibold text-slate-950">Payment summary</h4>
          {meetingFee > 0 && (
            <p className="text-sm">
              {meetingFeeDescription ?? "Meeting fee"}: £{meetingFee.toFixed(2)}
            </p>
          )}
          {enableDining && attendingDining && diningPrice != null && (
            <p className="text-sm">
              Dining{!enableGuestTickets && number_of_guests > 0 ? ` (1 + ${number_of_guests} guest(s))` : ""}: £{diningTotal.toFixed(2)}
            </p>
          )}
          {guestTotal > 0 && (
            <p className="text-sm">
              Guest tickets ({guests.length} × £{guestTicketPrice?.toFixed(2)}): £{guestTotal.toFixed(2)}
            </p>
          )}
          {enableCharity && (
            <div className="space-y-2">
              <Label>Charity donation {charityName && `(${charityName})`}</Label>
              <div className="flex flex-wrap gap-2">
                {charitySuggestedAmounts.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={charityAmount === a ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setValue("charity_amount", a)}
                  >
                    £{a}
                  </Button>
                ))}
                {charityAllowCustom && (
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Custom"
                    className="w-24"
                    onChange={(e) =>
                      setValue("charity_amount", e.target.value ? Number(e.target.value) : 0)
                    }
                  />
                )}
              </div>
            </div>
          )}
          {enableCharity && charityAmount > 0 && (
            <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gift_aid"
                  {...register("gift_aid")}
                  className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                />
                <Label htmlFor="gift_aid" className="font-semibold">
                  I would like to Gift Aid my donation
                </Label>
              </div>
              {giftAid && (
                <div className="space-y-4 pt-1">
                  <p className="text-sm leading-relaxed text-slate-600">
                    Gift Aid allows us to claim an extra 25p for every £1 you
                    donate at no cost to you.
                  </p>
                  <p className="text-xs leading-relaxed text-slate-500">
                    I am a UK taxpayer and understand that if I pay less Income
                    Tax and/or Capital Gains Tax than the amount of Gift Aid
                    claimed on all my donations in that tax year it is my
                    responsibility to pay any difference.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="gift_aid_confirmed"
                      {...register("gift_aid_confirmed")}
                      className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
                    />
                    <Label htmlFor="gift_aid_confirmed" className="text-sm">
                      I confirm I am eligible for Gift Aid
                    </Label>
                  </div>
                  {errors.gift_aid_confirmed && (
                    <p className="text-sm text-destructive">
                      {errors.gift_aid_confirmed.message}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="gift_aid_address_line_1" className="text-sm">
                        Address line 1 *
                      </Label>
                      <Input
                        id="gift_aid_address_line_1"
                        {...register("gift_aid_address_line_1")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gift_aid_address_line_2" className="text-sm">
                        Address line 2
                      </Label>
                      <Input
                        id="gift_aid_address_line_2"
                        {...register("gift_aid_address_line_2")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gift_aid_city" className="text-sm">
                        City *
                      </Label>
                      <Input
                        id="gift_aid_city"
                        {...register("gift_aid_city")}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="gift_aid_postcode" className="text-sm">
                        Postcode *
                      </Label>
                      <Input
                        id="gift_aid_postcode"
                        {...register("gift_aid_postcode")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {enableRaffle && (
            <div className="space-y-2">
              <Label>Raffle ticket strips</Label>
              <div className="flex flex-wrap gap-2">
                {raffleSuggestedAmounts.map((a) => (
                  <Button
                    key={a}
                    type="button"
                    variant={raffleAmount === a ? "default" : "secondary"}
                    size="sm"
                    onClick={() => setValue("raffle_amount", a)}
                  >
                    £{a}
                  </Button>
                ))}
                {raffleAllowCustom && (
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="Custom"
                    className="w-24"
                    onChange={(e) =>
                      setValue("raffle_amount", e.target.value ? Number(e.target.value) : 0)
                    }
                  />
                )}
              </div>
            </div>
          )}
          <p className="font-semibold text-slate-950">Total: £{total.toFixed(2)}</p>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} variant="primary">
        {isSubmitting ? "Sending..." : hasPayments && total > 0 ? "Proceed to payment" : "Submit RSVP"}
      </Button>
    </form>
  );
}
