"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type GuestPolicy = "blue_table" | "white_table";

type Props = {
  token: string;
  guestPolicy: GuestPolicy;
  payer: "guest" | "inviter";
  recipientName: string | null;
  recipientEmail: string | null;
  enableDining: boolean;
  diningPrice: number | null;
  diningDescription: string | null;
  enableServiceFee: boolean;
  serviceFeeAmount: number | null;
  serviceFeeDescription: string | null;
  enableCharity: boolean;
  charityName: string | null;
  charitySuggestedAmounts: number[];
  charityAllowCustom: boolean;
  enablePayments: boolean;
};

const baseSchema = z.object({
  full_name: z.string().min(1, "Your name is required"),
  email: z
    .string()
    .email("Please enter a valid email")
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
  attending_dining: z.boolean().default(false),
  dietary_requirements: z.string().optional(),
  partner_name: z.string().optional(),
  charity_amount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

const memberExtras = z.object({
  mother_church_name: z.string().min(1, "Your church name is required"),
  mother_church_number: z.string().optional(),
  constitution: z.string().optional(),
  rank: z.string().optional(),
});

function buildSchema(policy: GuestPolicy) {
  if (policy === "blue_table") {
    return baseSchema.merge(memberExtras);
  }
  return baseSchema;
}

export function GuestInvitationForm({
  token,
  guestPolicy,
  payer,
  recipientName,
  recipientEmail,
  enableDining,
  diningPrice,
  diningDescription,
  enableServiceFee,
  serviceFeeAmount,
  serviceFeeDescription,
  enableCharity,
  charityName,
  charitySuggestedAmounts,
  charityAllowCustom,
  enablePayments,
}: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const schema = useMemo(() => buildSchema(guestPolicy), [guestPolicy]);
  type FormData = z.infer<ReturnType<typeof buildSchema>>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: recipientName ?? "",
      email: recipientEmail ?? "",
      attending_dining: false,
    },
  });

  const attendingDining = watch("attending_dining");
  const charityAmount = (watch("charity_amount") as number | undefined) ?? 0;

  const serviceFee =
    payer === "guest" && enableServiceFee && serviceFeeAmount != null
      ? serviceFeeAmount
      : 0;
  const diningTotal =
    payer === "guest" && enableDining && attendingDining && diningPrice != null
      ? diningPrice
      : 0;
  const total = serviceFee + diningTotal + (charityAmount || 0);
  const requiresPayment = enablePayments && total > 0;

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch(`/api/g/${encodeURIComponent(token)}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          dining_total: diningTotal,
          service_fee: serviceFee,
          charity_amount: data.charity_amount ?? 0,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not confirm your booking.");
      }
      if (body?.url) {
        window.location.href = body.url as string;
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
        <p className="text-base font-semibold text-slate-950">
          You&apos;re confirmed
        </p>
        <p className="mt-2 text-sm text-slate-600">
          A welcome email is on its way. We look forward to seeing you.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Your name *</Label>
          <Input id="full_name" {...register("full_name")} />
          {errors.full_name ? (
            <p className="text-sm text-destructive">
              {errors.full_name.message as string}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            Email{" "}
            <span className="font-normal text-slate-400">
              (so we can send your confirmation)
            </span>
          </Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email ? (
            <p className="text-sm text-destructive">
              {errors.email.message as string}
            </p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" type="tel" {...register("phone")} />
        </div>
      </div>

      {guestPolicy === "blue_table" ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Your church details
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mother_church_name">Your church *</Label>
              <Input
                id="mother_church_name"
                {...register("mother_church_name" as never)}
              />
              {(errors as Record<string, { message?: string }>).mother_church_name ? (
                <p className="text-sm text-destructive">
                  {(errors as Record<string, { message?: string }>).mother_church_name?.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mother_church_number">Church number</Label>
              <Input
                id="mother_church_number"
                {...register("mother_church_number" as never)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="constitution">Constitution</Label>
              <Input
                id="constitution"
                placeholder="e.g. UGLE, Scotland, Ireland"
                {...register("constitution" as never)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rank">Rank</Label>
              <Input
                id="rank"
                placeholder="e.g. PM, PPrJGW"
                {...register("rank" as never)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="partner_name">Partner / +1 name (optional)</Label>
          <Input id="partner_name" {...register("partner_name")} />
        </div>
      )}

      {enableDining ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              {...register("attending_dining")}
              className="mt-1 h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
            />
            <span>
              <span className="block font-medium text-slate-950">
                Joining us for dining
                {payer === "guest" && diningPrice != null
                  ? ` (£${diningPrice.toFixed(2)})`
                  : payer === "inviter"
                    ? " (paid by inviter)"
                    : ""}
              </span>
              {diningDescription ? (
                <span className="mt-1 block text-sm text-slate-500">
                  {diningDescription}
                </span>
              ) : null}
            </span>
          </label>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="dietary_requirements">
          Dietary requirements / accessibility (optional)
        </Label>
        <Textarea
          id="dietary_requirements"
          rows={2}
          {...register("dietary_requirements")}
        />
      </div>

      {payer === "guest" && enableCharity && enablePayments ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <Label>
            Charity donation
            {charityName ? ` (${charityName})` : ""} (optional)
          </Label>
          <div className="flex flex-wrap gap-2">
            {charitySuggestedAmounts.map((amount) => (
              <Button
                key={amount}
                type="button"
                variant={charityAmount === amount ? "default" : "secondary"}
                size="sm"
                onClick={() => setValue("charity_amount", amount)}
              >
                £{amount}
              </Button>
            ))}
            {charityAllowCustom ? (
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="Custom"
                className="w-24"
                onChange={(event) =>
                  setValue(
                    "charity_amount",
                    event.target.value ? Number(event.target.value) : 0
                  )
                }
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {requiresPayment ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Total
          </p>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {serviceFee > 0 ? (
              <p>
                {serviceFeeDescription ?? "Service fee"}: £{serviceFee.toFixed(2)}
              </p>
            ) : null}
            {diningTotal > 0 ? <p>Dining: £{diningTotal.toFixed(2)}</p> : null}
            {(charityAmount ?? 0) > 0 ? (
              <p>Charity donation: £{(charityAmount ?? 0).toFixed(2)}</p>
            ) : null}
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-950">
            £{total.toFixed(2)}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            You will be redirected to a secure payment page. Payments are
            non-refundable.
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <Button type="submit" disabled={isSubmitting} variant="primary">
          {isSubmitting
            ? "Confirming..."
            : requiresPayment
              ? "Confirm and pay"
              : "Confirm attendance"}
        </Button>
        {requiresPayment ? (
          <p className="text-xs text-slate-500">
            As is custom in memberry, your place is confirmed at the point of
            payment and is{" "}
            <span className="font-semibold text-slate-700">non-refundable</span>.
            If you can no longer attend, please notify the church as soon as
            possible.
          </p>
        ) : (
          <p className="text-xs text-slate-500">
            Your place is confirmed as soon as you press the button above. If
            you can no longer attend, please notify the church as soon as
            possible.
          </p>
        )}
      </div>
    </form>
  );
}
