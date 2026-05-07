"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
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
import { Card, CardContent } from "@/components/ui/card";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  description: z.string().optional(),
  event_type: z.enum(["lodge_meeting", "lodge_of_instruction", "social", "charity"]),
  event_date: z.string().min(1, "Date is required"),
  event_time: z.string().optional(),
  location: z.string().optional(),
  temple_room: z.string().optional(),
  dress_code: z.string().optional(),
  enable_rsvp: z.boolean().default(true),
  enable_payments: z.boolean().default(false),
  enable_dining_rsvp: z.boolean().default(false),
  dining_price: z.coerce.number().min(0).optional(),
  dining_description: z.string().optional(),
  enable_charity_donation: z.boolean().default(false),
  charity_name: z.string().optional(),
  charity_description: z.string().optional(),
  enable_raffle_donation: z.boolean().default(false),
  raffle_description: z.string().optional(),
  enable_meeting_fee: z.boolean().default(false),
  meeting_fee_amount: z.coerce.number().min(0).optional(),
  meeting_fee_description: z.string().optional(),
  enable_guest_tickets: z.boolean().default(false),
  guest_ticket_price: z.coerce.number().min(0).optional(),
  guest_ticket_description: z.string().optional(),
  published: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

const defaultSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function EventForm({ eventId, defaultValues }: { eventId?: string; defaultValues?: Partial<FormData> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      event_type: "lodge_meeting",
      location: "Mark Masons' Hall",
      enable_rsvp: true,
      enable_payments: false,
      enable_dining_rsvp: false,
      enable_charity_donation: false,
      enable_raffle_donation: false,
      enable_meeting_fee: false,
      enable_guest_tickets: false,
      published: true,
      ...defaultValues,
    },
  });

  const title = watch("title");
  const enablePayments = watch("enable_payments");
  const enableDining = watch("enable_dining_rsvp");

  function syncSlug() {
    if (!eventId && title) setValue("slug", defaultSlug(title));
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const url = eventId ? `/api/events/${eventId}` : "/api/events";
      const method = eventId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save event");
      }
      const result = await res.json().catch(() => ({}));
      router.push(result.id ? `/admin/events/${result.id}` : "/admin/meetings");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-950">Basic details</h3>
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} onBlur={syncSlug} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug *</Label>
            <Input id="slug" {...register("slug")} placeholder="e.g. march-2026-meeting" />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} rows={3} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Event type *</Label>
              <Select
                value={watch("event_type")}
                onValueChange={(v) => setValue("event_type", v as FormData["event_type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lodge_meeting">Lodge meeting</SelectItem>
                  <SelectItem value="lodge_of_instruction">Lodge of instruction</SelectItem>
                  <SelectItem value="social">Social</SelectItem>
                  <SelectItem value="charity">Charity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event_date">Date *</Label>
              <Input id="event_date" type="datetime-local" {...register("event_date")} />
              {errors.event_date && <p className="text-sm text-destructive">{errors.event_date.message}</p>}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input id="location" {...register("location")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temple_room">Temple room</Label>
              <Input id="temple_room" {...register("temple_room")} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dress_code">Dress code</Label>
            <Input id="dress_code" {...register("dress_code")} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="enable_rsvp" {...register("enable_rsvp")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
            <Label htmlFor="enable_rsvp">Enable RSVP</Label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="published" {...register("published")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
            <Label htmlFor="published">Published (visible on site)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-950">Payments</h3>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="enable_payments" {...register("enable_payments")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
            <Label htmlFor="enable_payments">Enable payments</Label>
          </div>
          {enablePayments && (
            <>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_dining_rsvp" {...register("enable_dining_rsvp")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
                <Label htmlFor="enable_dining_rsvp">Dining (fixed price per person)</Label>
              </div>
              {enableDining && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dining_price">Dining price (£)</Label>
                    <Input id="dining_price" type="number" step="0.01" min={0} {...register("dining_price")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dining_description">Dining description</Label>
                    <Input id="dining_description" {...register("dining_description")} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_charity_donation" {...register("enable_charity_donation")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
                <Label htmlFor="enable_charity_donation">Charity donation (optional)</Label>
              </div>
              {watch("enable_charity_donation") && (
                <div className="space-y-2">
                  <Label htmlFor="charity_name">Charity name</Label>
                  <Input id="charity_name" {...register("charity_name")} />
                  <Label htmlFor="charity_description">Charity description</Label>
                  <Textarea id="charity_description" {...register("charity_description")} rows={2} />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_raffle_donation" {...register("enable_raffle_donation")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
                <Label htmlFor="enable_raffle_donation">Raffle contribution (optional)</Label>
              </div>
              {watch("enable_raffle_donation") && (
                <div className="space-y-2">
                  <Label htmlFor="raffle_description">Raffle description</Label>
                  <Input id="raffle_description" {...register("raffle_description")} placeholder="Help fund evening raffle prizes" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_meeting_fee" {...register("enable_meeting_fee")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
                <Label htmlFor="enable_meeting_fee">Meeting / ceremony fee</Label>
              </div>
              {watch("enable_meeting_fee") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="meeting_fee_amount">Fee amount (£)</Label>
                    <Input id="meeting_fee_amount" type="number" step="0.01" min={0} {...register("meeting_fee_amount")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting_fee_description">Fee description</Label>
                    <Input id="meeting_fee_description" {...register("meeting_fee_description")} placeholder="Meeting attendance fee" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input type="checkbox" id="enable_guest_tickets" {...register("enable_guest_tickets")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
                <Label htmlFor="enable_guest_tickets">Guest tickets (bring a visitor)</Label>
              </div>
              {watch("enable_guest_tickets") && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="guest_ticket_price">Price per guest (£)</Label>
                    <Input id="guest_ticket_price" type="number" step="0.01" min={0} {...register("guest_ticket_price")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guest_ticket_description">Guest ticket description</Label>
                    <Input id="guest_ticket_description" {...register("guest_ticket_description")} placeholder="Visitor dining ticket" />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSubmitting} variant="primary">
        {isSubmitting ? "Saving..." : eventId ? "Update event" : "Create event"}
      </Button>
    </form>
  );
}
