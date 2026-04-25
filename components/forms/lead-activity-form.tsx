"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  Phone,
  Mail,
  CheckSquare,
  Check,
  X,
  Loader2,
  Plus,
} from "lucide-react";

const ACTIVITY_TYPES = [
  { value: "note", label: "Note", icon: FileText, color: "text-blue-800 bg-blue-50 border-blue-200", activeColor: "border-blue-500 bg-blue-100 ring-2 ring-blue-200" },
  { value: "meeting", label: "Meeting", icon: Calendar, color: "text-amber-900 bg-amber-50 border-amber-200", activeColor: "border-amber-500 bg-amber-100 ring-2 ring-amber-200" },
  { value: "phone_call", label: "Phone", icon: Phone, color: "text-emerald-900 bg-emerald-50 border-emerald-200", activeColor: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-200" },
  { value: "email", label: "Email", icon: Mail, color: "text-cyan-900 bg-cyan-50 border-cyan-200", activeColor: "border-cyan-500 bg-cyan-100 ring-2 ring-cyan-200" },
  { value: "task", label: "Task", icon: CheckSquare, color: "text-violet-900 bg-violet-50 border-violet-200", activeColor: "border-violet-500 bg-violet-100 ring-2 ring-violet-200" },
] as const;

const schema = z.object({
  activity_type: z.enum(["note", "meeting", "phone_call", "email", "task"]),
  title: z.string().optional(),
  description: z.string().optional(),
  meeting_date: z.string().optional(),
  due_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export function LeadActivityForm({ leadId }: { leadId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [attendeeInput, setAttendeeInput] = useState("");
  const attendeeRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { activity_type: "note" },
  });

  const activityType = watch("activity_type");

  function addAttendee() {
    const trimmed = attendeeInput.trim();
    if (trimmed && !attendees.includes(trimmed)) {
      setAttendees((prev) => [...prev, trimmed]);
      setAttendeeInput("");
      attendeeRef.current?.focus();
    }
  }

  function removeAttendee(name: string) {
    setAttendees((prev) => prev.filter((a) => a !== name));
  }

  function handleAttendeeKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addAttendee();
    }
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const res = await fetch("/api/lead-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: leadId,
          activity_type: data.activity_type,
          title: data.title || null,
          description: data.description || null,
          meeting_date: data.meeting_date
            ? new Date(data.meeting_date).toISOString()
            : null,
          due_date: data.due_date
            ? new Date(data.due_date).toISOString()
            : null,
          attendees: attendees.length > 0 ? attendees : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to add activity");
      }
      setSubmitted(true);
      reset();
      setAttendees([]);
      setTimeout(() => {
        setSubmitted(false);
        window.location.reload();
      }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  const showMeetingDate = activityType === "meeting";
  const showDueDate = activityType === "task";
  const showAttendees = activityType === "meeting";

  return (
    <form id="activity-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <X className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {submitted && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <Check className="h-4 w-4 shrink-0" />
          Activity added successfully.
        </div>
      )}

      <div>
        <Label className="mb-2 block text-xs text-dash-muted">Activity type</Label>
        <div className="grid grid-cols-5 gap-2">
          {ACTIVITY_TYPES.map((type) => {
            const isSelected = activityType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() =>
                  setValue(
                    "activity_type",
                    type.value as FormData["activity_type"]
                  )
                }
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                  isSelected ? type.activeColor : type.color,
                  !isSelected && "opacity-60 hover:opacity-100"
                )}
              >
                <type.icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title" className="text-xs text-dash-muted">
          Title
        </Label>
        <Input
          id="title"
          {...register("title")}
          placeholder={
            activityType === "note"
              ? "Quick note title..."
              : activityType === "meeting"
              ? "Meeting with..."
              : activityType === "phone_call"
              ? "Called about..."
              : activityType === "email"
              ? "Email subject..."
              : "Task description..."
          }
          className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-xs text-dash-muted">
          Details
        </Label>
        <Textarea
          id="description"
          {...register("description")}
          rows={3}
          placeholder="Add details..."
          className="resize-none border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
        />
      </div>

      {showMeetingDate && (
        <div className="space-y-2">
          <Label htmlFor="meeting_date" className="text-xs text-dash-muted">
            Meeting date & time
          </Label>
          <Input
            id="meeting_date"
            type="datetime-local"
            {...register("meeting_date")}
            className="border-dash-border bg-dash-surface text-dash-text"
          />
        </div>
      )}

      {showDueDate && (
        <div className="space-y-2">
          <Label htmlFor="due_date" className="text-xs text-dash-muted">
            Due date
          </Label>
          <Input
            id="due_date"
            type="date"
            {...register("due_date")}
            className="border-dash-border bg-dash-surface text-dash-text"
          />
        </div>
      )}

      {showAttendees && (
        <div className="space-y-2">
          <Label className="text-xs text-dash-muted">Attendees</Label>
          <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
            {attendees.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs text-blue-900"
              >
                {name}
                <button
                  type="button"
                  onClick={() => removeAttendee(name)}
                  className="transition-colors hover:text-blue-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              ref={attendeeRef}
              value={attendeeInput}
              onChange={(e) => setAttendeeInput(e.target.value)}
              onKeyDown={handleAttendeeKeyDown}
              placeholder="Add attendee name..."
              className="border-dash-border bg-dash-surface text-dash-text placeholder:text-dash-faint"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addAttendee}
              className="shrink-0 text-dash-muted hover:text-dash-text"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        variant="primary"
        className="w-full"
      >
        {isSubmitting ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Adding...
          </span>
        ) : (
          "Add activity"
        )}
      </Button>
    </form>
  );
}
