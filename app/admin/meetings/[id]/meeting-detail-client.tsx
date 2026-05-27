"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  Globe,
  Link as LinkIcon,
  MapPin,
  Pencil,
  Send,
  Users,
  AlertTriangle,
  XCircle,
  EyeOff,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  type MeetingReadiness,
  READINESS_CLASSES,
} from "@/lib/meetings/readiness";
import {
  MeetingFormDrawer,
  formFromMeeting,
  parseSuggestedAmounts,
  slugify,
  type MeetingForm,
  type MeetingFormMeeting,
} from "../meeting-form";
import type { LodgeFeeDefaults } from "@/lib/fees/resolve";

type MeetingEvent = MeetingFormMeeting;

type RsvpEntry = {
  id: string;
  user_name: string;
  user_email: string;
  user_phone: string | null;
  status: string;
  attending_ceremony: boolean;
  attending_dining: boolean;
  number_of_guests: number;
  dietary_requirements: string | null;
  special_requests: string | null;
  payment_required: boolean;
  payment_completed: boolean;
  raffle_wine_pledged?: boolean;
  raffle_wine_bottles?: number;
  raffle_wine_note?: string | null;
};

type SummonsSummary = {
  id: string;
  issue_date: string;
  menu_items: string[];
  agenda_items: string[];
  dining_time: string | null;
  visiting_officer_name: string | null;
  visiting_officers: Array<{ name: string; email?: string | null; phone?: string | null }>;
  next_meeting_date: string | null;
};

type SummonsSend = {
  id: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

function typeLabel(t: string) {
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TYPE_BADGE: Record<string, string> = {
  regular_meeting: "border-blue-200 bg-blue-50 text-blue-900",
  lodge_meeting: "border-blue-200 bg-blue-50 text-blue-900",
  installation: "border-violet-200 bg-violet-50 text-violet-900",
  lodge_of_instruction: "border-cyan-200 bg-cyan-50 text-cyan-900",
  committee: "border-amber-200 bg-amber-50 text-amber-900",
  emergency: "border-rose-200 bg-rose-50 text-rose-900",
};

function formatPrice(value: number | null) {
  if (value == null) return "Not set";
  return `£${Number(value).toFixed(2)}`;
}

export function MeetingDetailClient({
  meeting,
  rsvps,
  readiness,
  summons,
  sends,
  publicUrl,
  publicPath,
  lodgeDefaults,
}: {
  meeting: MeetingEvent;
  rsvps: RsvpEntry[];
  readiness: MeetingReadiness;
  summons: SummonsSummary | null;
  sends: SummonsSend[];
  publicUrl: string;
  publicPath: string;
  lodgeDefaults: LodgeFeeDefaults | null;
}) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [meetingForm, setMeetingForm] = useState<MeetingForm>(() =>
    formFromMeeting(meeting)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const isPast = new Date(meeting.event_date) < new Date();
  const diningCount = rsvps.filter((r) => r.attending_dining).length;
  const guestCount = rsvps.reduce((sum, r) => sum + r.number_of_guests, 0);
  const unpaidCount = rsvps.filter(
    (r) => r.payment_required && !r.payment_completed
  ).length;
  const dietaryCount = rsvps.filter((r) => r.dietary_requirements).length;
  const winePledgers = rsvps.filter((r) => r.raffle_wine_pledged === true);
  const wineBottleCount = winePledgers.reduce(
    (sum, r) => sum + (r.raffle_wine_bottles ?? 0),
    0
  );
  const latestSend = sends[0] ?? null;

  function openEdit() {
    setMeetingForm(formFromMeeting(meeting));
    setFormError(null);
    setFormOpen(true);
  }

  function updateMeetingForm(updates: Partial<MeetingForm>) {
    setMeetingForm((current) => ({ ...current, ...updates }));
  }

  async function handleMeetingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormSaving(true);
    setFormError(null);

    // Derive enable_payments from whether any fee/charity is enabled. See
    // meetings-client.tsx for the same logic — keep these two in sync.
    const derivedEnablePayments =
      meetingForm.enable_meeting_fee ||
      meetingForm.enable_dining_rsvp ||
      meetingForm.enable_guest_tickets ||
      meetingForm.enable_charity_donation ||
      meetingForm.enable_raffle_donation;

    const payload = {
      ...meetingForm,
      slug: meetingForm.slug || slugify(meetingForm.title),
      event_time: meetingForm.event_time || null,
      dining_price: meetingForm.dining_price || null,
      meeting_fee_amount: meetingForm.meeting_fee_amount || null,
      guest_ticket_price: meetingForm.guest_ticket_price || null,
      max_attendees: meetingForm.max_attendees || null,
      rsvp_deadline: meetingForm.rsvp_deadline || null,
      enable_payments: derivedEnablePayments,
      charity_suggested_amounts: parseSuggestedAmounts(
        meetingForm.charity_suggested_amounts
      ),
      raffle_suggested_amounts: parseSuggestedAmounts(
        meetingForm.raffle_suggested_amounts
      ),
    };

    try {
      const res = await fetch(`/api/events/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to save meeting");
      }
      setFormOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not save meeting."
      );
    } finally {
      setFormSaving(false);
    }
  }

  async function copyPublicLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      setLinkCopied(false);
    }
  }

  async function togglePublished(next: boolean) {
    try {
      const res = await fetch(`/api/events/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formFromMeeting(meeting), published: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update");
      }
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Could not update publish state."
      );
    }
  }

  function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportRsvps() {
    downloadCsv(
      `${meeting.slug}-rsvps.csv`,
      [
        "Name",
        "Email",
        "Phone",
        "Status",
        "Ceremony",
        "Dining",
        "Guests",
        "Dietary",
        "Requests",
        "Payment",
      ],
      rsvps.map((rsvp) => [
        rsvp.user_name,
        rsvp.user_email,
        rsvp.user_phone ?? "",
        rsvp.status,
        rsvp.attending_ceremony ? "yes" : "no",
        rsvp.attending_dining ? "yes" : "no",
        String(rsvp.number_of_guests),
        rsvp.dietary_requirements ?? "",
        rsvp.special_requests ?? "",
        rsvp.payment_required
          ? rsvp.payment_completed
            ? "paid"
            : "unpaid"
          : "not required",
      ])
    );
  }

  function exportDining() {
    const dining = rsvps.filter((r) => r.attending_dining);
    downloadCsv(
      `${meeting.slug}-dining.csv`,
      ["Name", "Guests", "Dietary", "Requests", "Payment"],
      dining.map((r) => [
        r.user_name,
        String(r.number_of_guests),
        r.dietary_requirements ?? "",
        r.special_requests ?? "",
        r.payment_required
          ? r.payment_completed
            ? "paid"
            : "unpaid"
          : "n/a",
      ])
    );
  }

  function exportApologies() {
    const apologies = rsvps.filter(
      (r) => !r.attending_ceremony && r.status !== "cancelled"
    );
    downloadCsv(
      `${meeting.slug}-apologies.csv`,
      ["Name", "Email", "Phone", "Note"],
      apologies.map((r) => [
        r.user_name,
        r.user_email,
        r.user_phone ?? "",
        r.special_requests ?? "",
      ])
    );
  }

  function exportUnpaid() {
    const unpaid = rsvps.filter(
      (r) => r.payment_required && !r.payment_completed
    );
    downloadCsv(
      `${meeting.slug}-unpaid.csv`,
      ["Name", "Email", "Phone", "Status"],
      unpaid.map((r) => [r.user_name, r.user_email, r.user_phone ?? "", r.status])
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-dash-muted hover:text-dash-text"
        >
          <Link href="/admin/meetings" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to meetings
          </Link>
        </Button>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <CardContent className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-blue-800">
                <span className="text-[10px] font-medium uppercase leading-none">
                  {new Date(meeting.event_date).toLocaleDateString("en-GB", {
                    month: "short",
                  })}
                </span>
                <span className="mt-0.5 text-xl font-bold leading-none">
                  {new Date(meeting.event_date).getDate()}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-dash-text">
                  {meeting.title}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-dash-muted">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(meeting.event_date)}
                  </span>
                  {meeting.event_time && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {meeting.event_time}
                    </span>
                  )}
                  {meeting.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {meeting.location}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      TYPE_BADGE[meeting.event_type] ??
                      "border-slate-200 bg-slate-50 text-slate-800"
                    }
                  >
                    {typeLabel(meeting.event_type)}
                  </Badge>
                  {meeting.published ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-900"
                    >
                      <Globe className="mr-1 h-3 w-3" />
                      Published
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-amber-200 bg-amber-50 text-amber-900"
                    >
                      <EyeOff className="mr-1 h-3 w-3" />
                      Draft
                    </Badge>
                  )}
                  {isPast && (
                    <Badge
                      variant="outline"
                      className="border-slate-200 bg-slate-100 text-slate-700"
                    >
                      Past
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={openEdit} variant="primary">
                <Pencil className="mr-2 h-4 w-4" />
                Edit meeting
              </Button>
              <Button asChild variant="dashboard">
                <Link href={`/admin/meetings/${meeting.id}/summons/edit`}>
                  <Send className="mr-2 h-4 w-4" />
                  Edit summons
                </Link>
              </Button>
              <Button asChild variant="dashboard">
                <Link href={`/admin/meetings/${meeting.id}/summons`}>
                  <Eye className="mr-2 h-4 w-4" />
                  Open summons
                </Link>
              </Button>
            </div>
          </div>

          <div
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
              READINESS_CLASSES[readiness.status]
            )}
          >
            {readiness.status === "ready" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold">
                Meeting readiness: {readiness.label}
              </p>
              {readiness.issues.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs opacity-90">
                  {readiness.issues.map((issue) => (
                    <li key={issue.key}>• {issue.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              meeting.published
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/60"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dash-muted">
                  <LinkIcon className="h-3.5 w-3.5" />
                  Public link
                </div>
                {meeting.published ? (
                  <>
                    <p className="mt-2 break-all font-mono text-xs text-emerald-900">
                      {publicUrl}
                    </p>
                    <p className="mt-1 text-xs text-emerald-900/80">
                      Live and visible on the lodge website. Share this with
                      members and guests for RSVPs.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 break-all font-mono text-xs text-amber-900">
                      {publicUrl}
                    </p>
                    <p className="mt-1 text-xs text-amber-900/80">
                      This meeting is a draft and won&apos;t appear publicly
                      until you publish it. The URL above is reserved for when
                      you do.
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
                {meeting.published ? (
                  <>
                    <Button
                      type="button"
                      variant="dashboard"
                      size="sm"
                      onClick={copyPublicLink}
                    >
                      <Copy className="mr-2 h-3.5 w-3.5" />
                      {linkCopied ? "Copied" : "Copy link"}
                    </Button>
                    <Button asChild variant="primary" size="sm">
                      <Link
                        href={publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ArrowUpRight className="mr-2 h-3.5 w-3.5" />
                        Visit
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => togglePublished(true)}
                  >
                    <Globe className="mr-2 h-3.5 w-3.5" />
                    Publish
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">Meeting details</h2>
                <p className="dash-panel-header-description">
                  Where, when, and what to expect on the night.
                </p>
              </div>
            </div>
            <CardContent className="space-y-5 border-t border-dash-border bg-dash-surface p-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    Date
                  </dt>
                  <dd className="mt-1 text-sm text-dash-text">
                    {formatDate(meeting.event_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    Start time
                  </dt>
                  <dd className="mt-1 text-sm text-dash-text">
                    {meeting.event_time ?? "Not set"}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    Location
                  </dt>
                  <dd className="mt-1 text-sm text-dash-text">
                    {meeting.location ?? "Not set"}
                    {meeting.temple_room ? ` · ${meeting.temple_room}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    Dress code
                  </dt>
                  <dd className="mt-1 text-sm text-dash-text">
                    {meeting.dress_code ?? "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    RSVP deadline
                  </dt>
                  <dd className="mt-1 text-sm text-dash-text">
                    {meeting.rsvp_deadline
                      ? formatDate(meeting.rsvp_deadline)
                      : "No deadline"}
                  </dd>
                </div>
              </dl>
              {meeting.description && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
                    Description
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-sm leading-relaxed text-dash-text">
                    {meeting.description}
                  </dd>
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <div>
                <h2 className="dash-panel-header-title">RSVPs and dining</h2>
                <p className="dash-panel-header-description">
                  {rsvps.length} RSVP{rsvps.length === 1 ? "" : "s"} ·{" "}
                  {diningCount} dining · {guestCount} guest
                  {guestCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                  <p className="text-xs text-dash-muted">Dining</p>
                  <p className="font-semibold text-dash-text">{diningCount}</p>
                </div>
                <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                  <p className="text-xs text-dash-muted">Guests</p>
                  <p className="font-semibold text-dash-text">{guestCount}</p>
                </div>
                <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                  <p className="text-xs text-dash-muted">Dietary</p>
                  <p className="font-semibold text-dash-text">{dietaryCount}</p>
                </div>
                <div className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2">
                  <p className="text-xs text-dash-muted">Unpaid</p>
                  <p className="font-semibold text-dash-text">{unpaidCount}</p>
                </div>
              </div>

              {meeting.enable_raffle_wine_pledge && winePledgers.length > 0 && (
                <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
                  <p className="font-semibold">
                    Wine raffle: {wineBottleCount} bottle
                    {wineBottleCount === 1 ? "" : "s"} pledged by{" "}
                    {winePledgers.length} brother
                    {winePledgers.length === 1 ? "" : "s"}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {winePledgers.map((p) => (
                      <li key={p.id}>
                        {p.user_name} —{" "}
                        {p.raffle_wine_bottles ?? 1} bottle
                        {(p.raffle_wine_bottles ?? 1) === 1 ? "" : "s"}
                        {p.raffle_wine_note ? ` (${p.raffle_wine_note})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportRsvps}
                  disabled={rsvps.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> RSVPs
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportDining}
                  disabled={diningCount === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Dining
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportApologies}
                  disabled={rsvps.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Apologies
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportUnpaid}
                  disabled={unpaidCount === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Unpaid
                </Button>
              </div>

              {rsvps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-dash-border bg-dash-surface-subtle/40 py-10 text-center">
                  <Users className="mx-auto h-7 w-7 text-dash-text-faint" />
                  <p className="mt-3 text-sm text-dash-text-muted">
                    No RSVPs yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rsvps.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-dash-border bg-dash-surface-subtle/60 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-dash-text">
                          {r.user_name}
                        </p>
                        <p className="truncate text-xs text-dash-text-muted">
                          {r.user_email}
                        </p>
                        <p className="mt-1 text-xs text-dash-text-muted">
                          {r.attending_dining ? "Dining" : "No dining"}
                          {r.number_of_guests > 0
                            ? `, ${r.number_of_guests} guest${r.number_of_guests === 1 ? "" : "s"}`
                            : ""}
                          {r.dietary_requirements
                            ? `, Dietary: ${r.dietary_requirements}`
                            : ""}
                        </p>
                        {r.special_requests && (
                          <p className="mt-1 text-xs text-dash-text-muted">
                            Request: {r.special_requests}
                          </p>
                        )}
                        {r.raffle_wine_pledged && (
                          <p className="mt-1 text-xs font-medium text-violet-700">
                            Wine pledge:{" "}
                            {r.raffle_wine_bottles ?? 1}{" "}
                            bottle
                            {(r.raffle_wine_bottles ?? 1) === 1 ? "" : "s"}
                            {r.raffle_wine_note
                              ? ` — ${r.raffle_wine_note}`
                              : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {r.status === "confirmed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-dash-text-faint" />
                        )}
                        {r.payment_required && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              r.payment_completed
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            )}
                          >
                            {r.payment_completed ? "Paid" : "Unpaid"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <h3 className="dash-panel-header-title">Configuration</h3>
            </div>
            <CardContent className="border-t border-dash-border bg-dash-surface p-5">
              <dl className="space-y-3 text-sm">
                <ConfigRow
                  label="RSVP"
                  value={meeting.enable_rsvp ? "Enabled" : "Off"}
                />
                <ConfigRow
                  label="Dining"
                  value={
                    meeting.enable_dining_rsvp
                      ? formatPrice(meeting.dining_price)
                      : "Off"
                  }
                  hint={meeting.dining_description ?? undefined}
                />
                <ConfigRow
                  label="Payments"
                  value={meeting.enable_payments ? "Enabled" : "Off"}
                />
                <ConfigRow
                  label="Meeting fee"
                  value={
                    meeting.enable_meeting_fee
                      ? formatPrice(meeting.meeting_fee_amount)
                      : "Off"
                  }
                  hint={meeting.meeting_fee_description ?? undefined}
                />
                <ConfigRow
                  label="Charity"
                  value={
                    meeting.enable_charity_donation
                      ? meeting.charity_name ?? "Enabled"
                      : "Off"
                  }
                  hint={meeting.charity_description ?? undefined}
                />
                <ConfigRow
                  label="Raffle (cash)"
                  value={meeting.enable_raffle_donation ? "Enabled" : "Off"}
                  hint={meeting.raffle_description ?? undefined}
                />
                <ConfigRow
                  label="Wine pledge"
                  value={
                    meeting.enable_raffle_wine_pledge ? "Enabled" : "Off"
                  }
                  hint={meeting.raffle_wine_description ?? undefined}
                />
                <ConfigRow
                  label="Guest tickets"
                  value={
                    meeting.enable_guest_tickets
                      ? formatPrice(meeting.guest_ticket_price)
                      : "Off"
                  }
                  hint={meeting.guest_ticket_description ?? undefined}
                />
                <ConfigRow
                  label="Max attendees"
                  value={meeting.max_attendees?.toString() ?? "No limit"}
                />
              </dl>
            </CardContent>
          </Card>

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <h3 className="dash-panel-header-title">Summons</h3>
            </div>
            <CardContent className="space-y-3 border-t border-dash-border bg-dash-surface p-5 text-sm">
              {summons ? (
                <>
                  <div className="flex items-center justify-between text-dash-text">
                    <span className="text-dash-muted">Issue date</span>
                    <span className="font-medium">
                      {formatDate(summons.issue_date)}
                    </span>
                  </div>
                  {summons.dining_time && (
                    <div className="flex items-center justify-between text-dash-text">
                      <span className="text-dash-muted">Dinner</span>
                      <span className="font-medium">{summons.dining_time}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-dash-text">
                    <span className="text-dash-muted">Agenda items</span>
                    <span className="font-medium">
                      {summons.agenda_items.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-dash-text">
                    <span className="text-dash-muted">Menu items</span>
                    <span className="font-medium">
                      {summons.menu_items.length}
                    </span>
                  </div>
                  {(summons.visiting_officers.length > 0 ||
                    summons.visiting_officer_name) && (
                    <div className="flex items-center justify-between text-dash-text">
                      <span className="text-dash-muted">VO</span>
                      <span className="truncate font-medium text-right">
                        {summons.visiting_officers.length > 1
                          ? `${summons.visiting_officers.length} officers`
                          : summons.visiting_officers[0]?.name ??
                            summons.visiting_officer_name}
                      </span>
                    </div>
                  )}
                  {summons.next_meeting_date && (
                    <div className="flex items-center justify-between text-dash-text">
                      <span className="text-dash-muted">Next meeting</span>
                      <span className="font-medium">
                        {formatDate(summons.next_meeting_date)}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-dash-muted">
                  No summons drafted yet. Use &ldquo;Edit summons&rdquo; to
                  create one from the lodge defaults.
                </p>
              )}
              <div className="pt-2">
                <Button asChild variant="dashboard" size="sm" className="w-full">
                  <Link href={`/admin/meetings/${meeting.id}/summons/edit`}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    {summons ? "Edit summons" : "Draft summons"}
                  </Link>
                </Button>
              </div>
              {latestSend && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                  Last sent{" "}
                  {new Date(latestSend.created_at).toLocaleString("en-GB")} to{" "}
                  {latestSend.sent_count} of {latestSend.recipient_count}{" "}
                  members.
                  {latestSend.failed_count > 0
                    ? ` ${latestSend.failed_count} failed.`
                    : ""}
                </div>
              )}
            </CardContent>
          </Card>

          <Card variant="panel" className="overflow-hidden p-0">
            <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
              <h3 className="dash-panel-header-title">Visibility</h3>
            </div>
            <CardContent className="space-y-3 border-t border-dash-border bg-dash-surface p-5 text-sm">
              {meeting.published ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Live on the public lodge site</span>
                  </div>
                  <Button
                    type="button"
                    variant="dashboard"
                    size="sm"
                    className="w-full"
                    onClick={() => togglePublished(false)}
                  >
                    <EyeOff className="mr-2 h-3.5 w-3.5" />
                    Unpublish (return to draft)
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-amber-900">
                    <CircleDot className="h-4 w-4 text-amber-600" />
                    <span>Draft — not visible publicly</span>
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => togglePublished(true)}
                  >
                    <Globe className="mr-2 h-3.5 w-3.5" />
                    Publish now
                  </Button>
                </>
              )}
              {meeting.published && (
                <Button asChild variant="ghost" size="sm" className="w-full">
                  <Link
                    href={publicPath}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Visit public page
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MeetingFormDrawer
        open={formOpen}
        editing
        form={meetingForm}
        formError={formError}
        formSaving={formSaving}
        typeLabel={typeLabel}
        updateForm={updateMeetingForm}
        onClose={() => setFormOpen(false)}
        onSubmit={handleMeetingSubmit}
        lodgeDefaults={lodgeDefaults}
      />
    </div>
  );
}

function ConfigRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-xs font-medium uppercase tracking-wide text-dash-muted">
          {label}
        </dt>
        <dd className="text-sm font-medium text-dash-text">{value}</dd>
      </div>
      {hint && (
        <p className="mt-0.5 text-xs text-dash-text-muted">{hint}</p>
      )}
    </div>
  );
}
