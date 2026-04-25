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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";

const schema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().optional(),
  location: z.string().optional(),
  how_heard: z.string().optional(),
  message: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function ExpressionOfInterestForm({ lodgeSlug }: { lodgeSlug?: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const lodgeFromQuery = searchParams.get("lodge");
  const effectiveLodge = lodgeSlug ?? lodgeFromQuery ?? undefined;
  const lodgeQuery = effectiveLodge ? `?lodge=${encodeURIComponent(effectiveLodge)}` : "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      how_heard: "",
    },
  });

  const howHeard = watch("how_heard");

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch(`/api/leads${lodgeQuery}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Something went wrong");
      }
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[1.25rem] border border-green-200 bg-green-50 p-8 text-center">
        <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-3" />
        <p className="font-semibold text-slate-900">Thank you</p>
        <p className="mt-2 text-sm text-slate-600">
          We&apos;ve received your expression of interest and will be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First name *</Label>
          <Input id="first_name" {...register("first_name")} />
          {errors.first_name && (
            <p className="text-sm text-red-600">{errors.first_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last name *</Label>
          <Input id="last_name" {...register("last_name")} />
          {errors.last_name && (
            <p className="text-sm text-red-600">{errors.last_name.message}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input id="email" type="email" {...register("email")} />
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" type="tel" {...register("phone")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Location</Label>
        <Input id="location" {...register("location")} placeholder="e.g. London" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="how_heard">How did you hear about us?</Label>
        <Select value={howHeard} onValueChange={(v) => setValue("how_heard", v)}>
          <SelectTrigger id="how_heard">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="referral">Referral from a member</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="social">Social media</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">Message (optional)</Label>
        <Textarea
          id="message"
          {...register("message")}
          rows={4}
          placeholder="Any questions or anything you'd like us to know?"
        />
      </div>
      <Button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full"
        variant="primary"
      >
        {isSubmitting ? "Sending..." : "Submit"}
      </Button>
    </form>
  );
}
