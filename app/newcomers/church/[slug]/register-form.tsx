"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  full_name: z.string().min(1, "Your name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  is_member: z.boolean().default(false),
  mother_church_name: z.string().optional(),
  mother_church_number: z.string().optional(),
  constitution: z.string().optional(),
  rank: z.string().optional(),
  dietary_requirements: z.string().optional(),
  website: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  churchSlug: string;
};

export function NewcomerRegisterForm({ churchSlug }: Props) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_member: false },
  });

  const ismember = watch("is_member");

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch(
        `/api/newcomers/church/${encodeURIComponent(churchSlug)}/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not save your details.");
      }
      if (body?.url) {
        window.location.href = body.url as string;
        return;
      }
      throw new Error("No redirect URL returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        {...register("website")}
        className="absolute left-[-9999px] h-0 w-0"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Your name *</Label>
          <Input
            id="full_name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="next"
            {...register("full_name")}
          />
          {errors.full_name ? (
            <p className="text-sm text-destructive">
              {errors.full_name.message as string}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            enterKeyHint="next"
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">
              {errors.email.message as string}
            </p>
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input
            id="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint="next"
            {...register("phone")}
          />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input
          type="checkbox"
          {...register("is_member")}
          className="mt-1 h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
        />
        <span>
          <span className="block font-medium text-slate-950">
            I am a member
          </span>
          <span className="mt-1 block text-sm text-slate-500">
            Tick this if you would like to be considered for newcomer members
            events (blue table).
          </span>
        </span>
      </label>

      {ismember ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Your church details
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mother_church_name">Your church</Label>
              <Input
                id="mother_church_name"
                {...register("mother_church_name")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mother_church_number">Church number</Label>
              <Input
                id="mother_church_number"
                {...register("mother_church_number")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="constitution">Constitution</Label>
              <Input
                id="constitution"
                placeholder="e.g. UGLE, Scotland, Ireland"
                {...register("constitution")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rank">Rank</Label>
              <Input
                id="rank"
                placeholder="e.g. PM, PPrJGW"
                {...register("rank")}
              />
            </div>
          </div>
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

      <Button type="submit" variant="primary" disabled={isSubmitting}>
        {isSubmitting ? "Submitting..." : "Join the directory"}
      </Button>
      <p className="text-xs text-slate-500">
        We will email you a private link you can use any time to book future
        visits.
      </p>
    </form>
  );
}
