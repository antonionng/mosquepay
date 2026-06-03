"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Globe,
  Lock,
  Link as LinkIcon,
  MapPin,
  Pencil,
  PoundSterling,
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
import { MeetingClosePanel } from "./meeting-close-panel";
import {
  reconcileMeeting,
  METHOD_GROUP_LABEL,
  type PaymentMethodGroup,
} from "@/lib/meetings/reconcile";

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
  payment_id: string | null;
  raffle_wine_pledged?: boolean;
  raffle_wine_bottles?: number;
  raffle_wine_note?: string | null;
};

type GuestEntry = {
  id: string;
  rsvp_id: string | null;
  event_id: string;
  guest_name: string;
  dietary_requirements: string | null;
  email: string | null;
  phone: string | null;
};

type PaymentEntry = {
  id: string;
  rsvp_id: string | null;
  event_id: string | null;
  user_email: string;
  user_name: string | null;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  meeting_fee_amount: number;
  guest_ticket_amount: number;
  total_amount: number;
  currency: string;
  status: string;
  refund_amount: number;
  payment_method?:
    | "card_qr"
    | "card_online"
    | "cash"
    | "cheque"
    | "bacs"
    | "other"
    | null;
  mooov_payment_id?: string | null;
  stripe_payment_intent_id?: string | null;
  recorded_by_email?: string | null;
  created_at: string;
  completed_at: string | null;
};

/**
 * A row in the rsvps table with `status === "payment_pending"` represents
 * a brother who tapped through to checkout but never finished paying.
 * Until the Mooov webhook flips it to `confirmed` we treat it as a ghost:
 * no dining count, no guest count, no wine pledge, no CSV row. They still
 * show up in the dedicated "Unpaid" tile/export so the secretary can chase
 * them, but they no longer pollute the main RSVP list.
 */
function isConfirmedRsvp(rsvp: RsvpEntry): boolean {
  if (rsvp.status === "payment_pending") return false;
  if (rsvp.status === "cancelled") return false;
  if (rsvp.payment_required && !rsvp.payment_completed) return false;
  return true;
}

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

/**
 * Tri-state visibility for the admin detail page. Mirrors
 * `isPubliclyVisible` from `lib/events/public-visibility.ts` so the UI never
 * shows a "Visit" affordance that would 404.
 *
 *   - draft         → not published yet
 *   - members_only  → published, but the public route still 404s
 *                     (regular meeting without feature_on_website, or
 *                     guest_policy === 'closed')
 *   - public        → both flags align, the public URL renders
 */
export type MeetingVisibility = "draft" | "members_only" | "public";

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

export type MeetingFinance = {
  meeting: {
    succeededTotal: number;
    pendingTotal: number;
    succeededCount: number;
    pendingCount: number;
    charity: number;
    dining: number;
    raffle: number;
    meetingFee: number;
    guestTicket: number;
    refunded: number;
  };
  lodgeAllTime: number;
  currency: string;
};

export function MeetingDetailClient({
  meeting,
  rsvps: allRsvps,
  guests,
  payments,
  readiness,
  summons,
  sends,
  publicUrl,
  publicPath,
  previewPath,
  visibility,
  visibilityReason,
  canFeatureOnWebsite,
  lodgeDefaults,
  finance,
  closeState,
  unattributed,
}: {
  meeting: MeetingEvent;
  rsvps: RsvpEntry[];
  guests: GuestEntry[];
  payments: PaymentEntry[];
  readiness: MeetingReadiness;
  summons: SummonsSummary | null;
  sends: SummonsSend[];
  publicUrl: string;
  publicPath: string;
  previewPath: string;
  visibility: MeetingVisibility;
  visibilityReason: string | null;
  /**
   * True when this meeting's event_type is private by default but could
   * be promoted to the public site by ticking `feature_on_website`. False
   * for naturally-public types (social/charity) and closed meetings.
   */
  canFeatureOnWebsite: boolean;
  lodgeDefaults: LodgeFeeDefaults | null;
  finance?: MeetingFinance;
  /**
   * Per-meeting Gift Aid close state (migration 059 + 060). Populated by
   * the meeting page when supabase is configured; absent for mock mode.
   */
  closeState?: {
    meeting_closed_at: string | null;
    meeting_closed_by_email: string | null;
    charity_amount: number;
    charity_count: number;
    new_declarations_preview: number;
    closed_batch_id: string | null;
    closed_batch_declarations_count: number;
    currency: string;
  };
  /** Collected payments taken on the meeting date but not tagged to any meeting. */
  unattributed?: { count: number; total: number };
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

  // Split confirmed (paid or no payment required) RSVPs from
  // abandoned-checkout ones. The main RSVP/dining/guest views only count
  // confirmed rows, but the Unpaid tile + export still surface the
  // abandoned ones so the secretary can chase them.
  const rsvps = useMemo(() => allRsvps.filter(isConfirmedRsvp), [allRsvps]);
  const abandonedRsvps = useMemo(
    () => allRsvps.filter((r) => !isConfirmedRsvp(r)),
    [allRsvps]
  );

  const diningCount = rsvps.filter((r) => r.attending_dining).length;
  const guestCount = rsvps.reduce((sum, r) => sum + r.number_of_guests, 0);
  const unpaidCount = abandonedRsvps.length;
  const dietaryCount = rsvps.filter((r) => r.dietary_requirements).length;
  const apologiesCount = rsvps.filter(
    (r) => !r.attending_ceremony && r.status !== "cancelled"
  ).length;
  const winePledgers = rsvps.filter((r) => r.raffle_wine_pledged === true);
  const wineBottleCount = winePledgers.reduce(
    (sum, r) => sum + (r.raffle_wine_bottles ?? 0),
    0
  );
  const latestSend = sends[0] ?? null;

  // Index guests by their RSVP so each card can show the actual people
  // the brother is bringing. Guests added directly against an event with
  // no RSVP (rare) are dropped here on purpose: they show up in the
  // dedicated Guests export below.
  const guestsByRsvp = useMemo(() => {
    const map = new Map<string, GuestEntry[]>();
    for (const g of guests) {
      if (!g.rsvp_id) continue;
      const list = map.get(g.rsvp_id) ?? [];
      list.push(g);
      map.set(g.rsvp_id, list);
    }
    return map;
  }, [guests]);

  // Map each RSVP to its succeeded payment row so the export can write
  // out the per-bucket money. Only succeeded payments contribute, since a
  // pending/abandoned payment didn't actually raise anything.
  const paymentByRsvp = useMemo(() => {
    const succeededSet = new Set([
      "succeeded",
      "completed",
      "paid",
      "partially_refunded",
    ]);
    const map = new Map<string, PaymentEntry>();
    for (const p of payments) {
      if (!p.rsvp_id) continue;
      if (!succeededSet.has(p.status)) continue;
      const existing = map.get(p.rsvp_id);
      if (!existing) {
        map.set(p.rsvp_id, p);
        continue;
      }
      const existingDate = existing.completed_at ?? existing.id;
      const candidateDate = p.completed_at ?? p.id;
      if (candidateDate > existingDate) map.set(p.rsvp_id, p);
    }
    return map;
  }, [payments]);

  const moneyFmt = (n: number) => n.toFixed(2);

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

  async function patchMeeting(
    overrides: Partial<MeetingForm>,
    failureMessage: string
  ) {
    try {
      const res = await fetch(`/api/events/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formFromMeeting(meeting), ...overrides }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update");
      }
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : failureMessage
      );
    }
  }

  async function togglePublished(next: boolean) {
    await patchMeeting(
      { published: next },
      "Could not update publish state."
    );
  }

  async function toggleFeatureOnWebsite(next: boolean) {
    await patchMeeting(
      { feature_on_website: next },
      "Could not update website visibility."
    );
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
        "Guest names",
        "Dietary (brother)",
        "Dietary (guests)",
        "Requests",
        "Wine bottles",
        "Wine note",
        "Payment status",
        "Meeting fee (\u00a3)",
        "Dining (\u00a3)",
        "Guest tickets (\u00a3)",
        "Charity (\u00a3)",
        "Raffle (\u00a3)",
        "Total paid (\u00a3)",
        "Refunded (\u00a3)",
      ],
      rsvps.map((rsvp) => {
        const partyGuests = guestsByRsvp.get(rsvp.id) ?? [];
        const payment = paymentByRsvp.get(rsvp.id) ?? null;
        return [
          rsvp.user_name,
          rsvp.user_email,
          rsvp.user_phone ?? "",
          rsvp.status,
          rsvp.attending_ceremony ? "yes" : "no",
          rsvp.attending_dining ? "yes" : "no",
          String(rsvp.number_of_guests),
          partyGuests.map((g) => g.guest_name).join("; "),
          rsvp.dietary_requirements ?? "",
          partyGuests
            .filter((g) => g.dietary_requirements)
            .map((g) => `${g.guest_name}: ${g.dietary_requirements}`)
            .join("; "),
          rsvp.special_requests ?? "",
          rsvp.raffle_wine_pledged ? String(rsvp.raffle_wine_bottles ?? 0) : "",
          rsvp.raffle_wine_pledged ? rsvp.raffle_wine_note ?? "" : "",
          rsvp.payment_required
            ? rsvp.payment_completed
              ? "paid"
              : "unpaid"
            : "not required",
          payment ? moneyFmt(payment.meeting_fee_amount) : "",
          payment ? moneyFmt(payment.dining_amount) : "",
          payment ? moneyFmt(payment.guest_ticket_amount) : "",
          payment ? moneyFmt(payment.charity_amount) : "",
          payment ? moneyFmt(payment.raffle_amount) : "",
          payment ? moneyFmt(payment.total_amount) : "",
          payment && payment.refund_amount > 0
            ? moneyFmt(payment.refund_amount)
            : "",
        ];
      })
    );
  }

  function exportDining() {
    const dining = rsvps.filter((r) => r.attending_dining);
    downloadCsv(
      `${meeting.slug}-dining.csv`,
      [
        "Name",
        "Email",
        "Guests",
        "Guest names",
        "Dietary (brother)",
        "Dietary (guests)",
        "Requests",
        "Dining paid (\u00a3)",
        "Guest tickets paid (\u00a3)",
        "Payment status",
      ],
      dining.map((r) => {
        const partyGuests = guestsByRsvp.get(r.id) ?? [];
        const payment = paymentByRsvp.get(r.id) ?? null;
        return [
          r.user_name,
          r.user_email,
          String(r.number_of_guests),
          partyGuests.map((g) => g.guest_name).join("; "),
          r.dietary_requirements ?? "",
          partyGuests
            .filter((g) => g.dietary_requirements)
            .map((g) => `${g.guest_name}: ${g.dietary_requirements}`)
            .join("; "),
          r.special_requests ?? "",
          payment ? moneyFmt(payment.dining_amount) : "",
          payment ? moneyFmt(payment.guest_ticket_amount) : "",
          r.payment_required
            ? r.payment_completed
              ? "paid"
              : "unpaid"
            : "n/a",
        ];
      })
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
    // Drives off the abandoned-checkout pool that we hide from the main
    // list. The secretary still needs this view to chase them.
    downloadCsv(
      `${meeting.slug}-unpaid.csv`,
      [
        "Name",
        "Email",
        "Phone",
        "Status",
        "Ceremony",
        "Dining",
        "Guests",
        "Started checkout at",
      ],
      abandonedRsvps.map((r) => [
        r.user_name,
        r.user_email,
        r.user_phone ?? "",
        r.status,
        r.attending_ceremony ? "yes" : "no",
        r.attending_dining ? "yes" : "no",
        String(r.number_of_guests),
        "",
      ])
    );
  }

  function exportGuests() {
    // One row per guest (not per RSVP) so the dining secretary can
    // build their place-card list directly from this CSV.
    const rows: string[][] = [];
    for (const rsvp of rsvps) {
      const partyGuests = guestsByRsvp.get(rsvp.id) ?? [];
      for (const g of partyGuests) {
        rows.push([
          g.guest_name,
          rsvp.user_name,
          rsvp.user_email,
          g.dietary_requirements ?? "",
          g.email ?? "",
          g.phone ?? "",
        ]);
      }
    }
    downloadCsv(
      `${meeting.slug}-guests.csv`,
      [
        "Guest name",
        "Brought by",
        "Brother email",
        "Dietary",
        "Guest email",
        "Guest phone",
      ],
      rows
    );
  }

  function exportDonations() {
    // Charity + raffle ticket strips per brother. Only includes RSVPs
    // whose payment actually settled, so the total here matches the
    // money-raised card on the right.
    const rows: string[][] = [];
    for (const rsvp of rsvps) {
      const payment = paymentByRsvp.get(rsvp.id);
      if (!payment) continue;
      if (
        payment.charity_amount <= 0 &&
        payment.raffle_amount <= 0 &&
        !rsvp.raffle_wine_pledged
      ) {
        continue;
      }
      rows.push([
        rsvp.user_name,
        rsvp.user_email,
        moneyFmt(payment.charity_amount),
        moneyFmt(payment.raffle_amount),
        rsvp.raffle_wine_pledged
          ? String(rsvp.raffle_wine_bottles ?? 0)
          : "0",
        rsvp.raffle_wine_pledged ? rsvp.raffle_wine_note ?? "" : "",
      ]);
    }
    downloadCsv(
      `${meeting.slug}-donations.csv`,
      [
        "Name",
        "Email",
        "Charity (\u00a3)",
        "Raffle strips (\u00a3)",
        "Wine bottles pledged",
        "Wine note",
      ],
      rows
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
                  {visibility === "public" && (
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-900"
                    >
                      <Globe className="mr-1 h-3 w-3" />
                      Public website
                    </Badge>
                  )}
                  {visibility === "members_only" && (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-blue-900"
                    >
                      <Lock className="mr-1 h-3 w-3" />
                      Members only
                    </Badge>
                  )}
                  {visibility === "draft" && (
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
              visibility === "public" && "border-emerald-200 bg-emerald-50/60",
              visibility === "members_only" &&
                "border-blue-200 bg-blue-50/60",
              visibility === "draft" && "border-amber-200 bg-amber-50/60"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dash-muted">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {visibility === "public" && "Public link"}
                  {visibility === "members_only" && "Private preview"}
                  {visibility === "draft" && "Draft preview"}
                </div>
                {visibility === "public" && (
                  <>
                    <p className="mt-2 break-all font-mono text-xs text-emerald-900">
                      {publicUrl}
                    </p>
                    <p className="mt-1 text-xs text-emerald-900/80">
                      Live and visible on the lodge website. Share this with
                      members and guests for RSVPs.
                    </p>
                  </>
                )}
                {visibility === "members_only" && (
                  <>
                    <p className="mt-2 text-xs text-blue-900">
                      This meeting is published for members but not on the
                      public website, so its public URL would 404 for
                      visitors. Use the admin preview to QA the page, and
                      share it with members through the summons.
                    </p>
                    {visibilityReason && (
                      <p className="mt-1 text-xs text-blue-900/80">
                        {visibilityReason}
                      </p>
                    )}
                  </>
                )}
                {visibility === "draft" && (
                  <>
                    <p className="mt-2 text-xs text-amber-900">
                      Draft &mdash; this meeting hasn&apos;t been published
                      yet, so its public URL would 404. Preview the page as
                      an admin before publishing.
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-amber-900/70">
                      {publicUrl}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
                {visibility === "public" && (
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
                )}
                {visibility === "members_only" && (
                  <>
                    <Button asChild variant="primary" size="sm">
                      <Link
                        href={previewPath}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="mr-2 h-3.5 w-3.5" />
                        Admin preview
                      </Link>
                    </Button>
                    {canFeatureOnWebsite && (
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        onClick={() => toggleFeatureOnWebsite(true)}
                      >
                        <Globe className="mr-2 h-3.5 w-3.5" />
                        Make public
                      </Button>
                    )}
                  </>
                )}
                {visibility === "draft" && (
                  <>
                    <Button asChild variant="dashboard" size="sm">
                      <Link
                        href={previewPath}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Eye className="mr-2 h-3.5 w-3.5" />
                        Preview
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => togglePublished(true)}
                    >
                      <Globe className="mr-2 h-3.5 w-3.5" />
                      Publish
                    </Button>
                  </>
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
                  {guestCount === 1 ? "" : "s"} · {apologiesCount}{" "}
                  apolog{apologiesCount === 1 ? "y" : "ies"}
                </p>
              </div>
            </div>
            <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-6">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
                  <p className="text-xs text-dash-muted">Apologies</p>
                  <p className="font-semibold text-dash-text">
                    {apologiesCount}
                  </p>
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

              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
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
                  onClick={exportGuests}
                  disabled={guestCount === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Guests
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportDonations}
                  disabled={rsvps.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Donations
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={exportApologies}
                  disabled={apologiesCount === 0}
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
                    No confirmed RSVPs yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rsvps.map((r) => {
                    const partyGuests = guestsByRsvp.get(r.id) ?? [];
                    return (
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
                          {partyGuests.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs text-dash-text-muted">
                              {partyGuests.map((g) => (
                                <li key={g.id} className="flex flex-wrap items-baseline gap-1">
                                  <span className="font-medium text-dash-text">
                                    {g.guest_name}
                                  </span>
                                  {g.dietary_requirements ? (
                                    <span className="text-dash-text-muted">
                                      ({g.dietary_requirements})
                                    </span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.number_of_guests > 0 &&
                            partyGuests.length < r.number_of_guests && (
                              <p className="mt-1 text-xs text-amber-700">
                                {r.number_of_guests - partyGuests.length} guest
                                name{r.number_of_guests - partyGuests.length === 1 ? "" : "s"}
                                {" "}not captured yet.
                              </p>
                            )}
                          {r.special_requests && (
                            <p className="mt-1 text-xs text-dash-text-muted">
                              Request: {r.special_requests}
                            </p>
                          )}
                          {r.raffle_wine_pledged && (
                            <p className="mt-1 text-xs font-medium text-violet-700">
                              Wine pledge: {r.raffle_wine_bottles ?? 1} bottle
                              {(r.raffle_wine_bottles ?? 1) === 1 ? "" : "s"}
                              {r.raffle_wine_note
                                ? ` (${r.raffle_wine_note})`
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
                    );
                  })}
                </div>
              )}

              {abandonedRsvps.length > 0 && (
                <details className="rounded-lg border border-amber-200 bg-amber-50/60">
                  <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-amber-900">
                    {abandonedRsvps.length} abandoned checkout
                    {abandonedRsvps.length === 1 ? "" : "s"} (not counted)
                  </summary>
                  <ul className="space-y-1 px-3 pb-3 text-xs text-amber-900/90">
                    {abandonedRsvps.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{r.user_name}</span>
                        <span className="text-amber-900/70">
                          {r.user_email}
                        </span>
                        <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-800">
                          {r.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 sm:space-y-6">
          {finance ? (
            <MoneyRaisedCard
              eventId={meeting.id}
              finance={finance}
              meetingHasFees={Boolean(
                meeting.enable_meeting_fee ||
                  meeting.enable_dining_rsvp ||
                  meeting.enable_guest_tickets ||
                  meeting.enable_charity_donation ||
                  meeting.enable_raffle_donation,
              )}
              enabled={{
                meetingFee: Boolean(meeting.enable_meeting_fee),
                dining: Boolean(meeting.enable_dining_rsvp),
                guestTicket: Boolean(meeting.enable_guest_tickets),
                charity: Boolean(meeting.enable_charity_donation),
                raffle: Boolean(meeting.enable_raffle_donation),
              }}
            />
          ) : null}

          <ReconcileCard
            eventId={meeting.id}
            payments={payments}
            unattributed={unattributed}
            currency={finance?.currency ?? "GBP"}
          />

          {closeState ? (
            <MeetingClosePanel
              eventId={meeting.id}
              isPast={isPast}
              closedAt={closeState.meeting_closed_at}
              closedByEmail={closeState.meeting_closed_by_email}
              charityAmount={closeState.charity_amount}
              charityCount={closeState.charity_count}
              newDeclarationsPreview={closeState.new_declarations_preview}
              closedBatchId={closeState.closed_batch_id}
              closedBatchDeclarationsCount={closeState.closed_batch_declarations_count}
              currency={closeState.currency}
            />
          ) : null}

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
                  label="Raffle ticket strips"
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
              {visibility === "public" && (
                <div className="flex items-center gap-2 text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Live on the public lodge site</span>
                </div>
              )}
              {visibility === "members_only" && (
                <div className="flex items-center gap-2 text-blue-900">
                  <Lock className="h-4 w-4 text-blue-600" />
                  <span>Published &mdash; members only, not on public site</span>
                </div>
              )}
              {visibility === "draft" && (
                <div className="flex items-center gap-2 text-amber-900">
                  <CircleDot className="h-4 w-4 text-amber-600" />
                  <span>Draft &mdash; not visible to anyone yet</span>
                </div>
              )}

              {visibility === "draft" ? (
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
              ) : (
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
              )}

              {canFeatureOnWebsite && meeting.published && (
                <div className="rounded-lg border border-dash-border bg-dash-surface-subtle/60 p-3">
                  <label className="flex cursor-pointer items-start gap-2 text-xs text-dash-text">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={meeting.feature_on_website}
                      onChange={(event) =>
                        toggleFeatureOnWebsite(event.target.checked)
                      }
                    />
                    <span className="min-w-0">
                      <span className="block font-medium text-dash-text">
                        Show on the public lodge website
                      </span>
                      <span className="mt-0.5 block text-dash-muted">
                        Off by default for this meeting type. Turn on for
                        installations or other meetings you want visitors to
                        see.
                      </span>
                    </span>
                  </label>
                </div>
              )}

              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link
                  href={previewPath}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Eye className="mr-2 h-3.5 w-3.5" />
                  Admin preview
                </Link>
              </Button>
              {visibility === "public" && (
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

function ReconcileCard({
  eventId,
  payments,
  unattributed,
  currency,
}: {
  eventId: string;
  payments: PaymentEntry[];
  unattributed?: { count: number; total: number };
  currency: string;
}) {
  const [rafflePrice, setRafflePrice] = useState(5);
  const [counted, setCounted] = useState("");

  useEffect(() => {
    const savedPrice = window.localStorage.getItem("c0v.rafflePricePerStrip");
    const n = savedPrice ? Number(savedPrice) : NaN;
    if (Number.isFinite(n) && n > 0) setRafflePrice(n);
    const savedCounted = window.localStorage.getItem(
      `c0v.cashCounted.${eventId}`,
    );
    if (savedCounted != null) setCounted(savedCounted);
  }, [eventId]);

  const updateCounted = (value: string) => {
    setCounted(value);
    window.localStorage.setItem(`c0v.cashCounted.${eventId}`, value);
  };

  const recon = useMemo(
    () => reconcileMeeting(payments, { rafflePrice }),
    [payments, rafflePrice],
  );

  const countedNum = counted.trim() === "" ? null : Number(counted);
  const variance =
    countedNum != null && Number.isFinite(countedNum)
      ? countedNum - recon.byMethod.cash.amount
      : null;

  const methodOrder: PaymentMethodGroup[] = ["cash", "lodgepay", "other"];
  const activeMethods = methodOrder.filter(
    (m) => recon.byMethod[m].amount > 0 || recon.byMethod[m].count > 0,
  );

  const reportHref = `/admin/meetings/${eventId}/report?strip=${encodeURIComponent(
    String(rafflePrice),
  )}${countedNum != null && Number.isFinite(countedNum) ? `&counted=${encodeURIComponent(String(countedNum))}` : ""}`;

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-slate-700" />
          <h3 className="dash-panel-header-title">Reconcile &amp; report</h3>
        </div>
      </div>
      <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-5">
        {recon.collectedCount === 0 ? (
          <p className="rounded-md border border-dashed border-dash-border bg-dash-surface-subtle/40 px-3 py-2 text-xs text-dash-text-muted">
            No settled payments yet. Once cash and LodgePay takings are in,
            you&rsquo;ll see the cash-vs-card split and a variance check here.
          </p>
        ) : (
          <>
            <div className="space-y-1.5">
              {activeMethods.map((m) => {
                const t = recon.byMethod[m];
                const pct =
                  recon.collectedTotal > 0
                    ? Math.round((t.amount / recon.collectedTotal) * 100)
                    : 0;
                return (
                  <div
                    key={m}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-dash-text-muted">
                      {METHOD_GROUP_LABEL[m]}{" "}
                      <span className="text-dash-faint">({t.count})</span>
                    </span>
                    <span className="font-medium tabular-nums text-dash-text">
                      {formatMoney(t.amount, currency)}{" "}
                      <span className="text-dash-faint">· {pct}%</span>
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-dash-border pt-1.5 text-sm font-semibold">
                <span>Collected</span>
                <span className="tabular-nums">
                  {formatMoney(recon.collectedTotal, currency)}
                </span>
              </div>
            </div>

            {recon.raffleStrips > 0 ? (
              <p className="text-xs text-dash-text-muted">
                Raffle: {recon.raffleStrips} strip
                {recon.raffleStrips === 1 ? "" : "s"} to {recon.raffleBuyers}{" "}
                {recon.raffleBuyers === 1 ? "buyer" : "buyers"} (at{" "}
                {formatMoney(rafflePrice, currency)}/strip)
              </p>
            ) : null}

            <div className="rounded-lg border border-dash-border bg-dash-surface-subtle/40 p-3">
              <label
                htmlFor="cash-counted"
                className="text-xs font-medium text-dash-text"
              >
                Count the tin
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-dash-faint">
                    £
                  </span>
                  <input
                    id="cash-counted"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.01}
                    placeholder="Counted cash"
                    value={counted}
                    onChange={(e) => updateCounted(e.target.value)}
                    className="h-9 w-full rounded-lg border border-dash-border bg-dash-surface pl-5 pr-2 text-sm tabular-nums text-dash-text outline-none focus:border-dash-ring"
                  />
                </div>
                <div className="text-right text-xs">
                  <p className="text-dash-faint">Recorded</p>
                  <p className="font-medium tabular-nums text-dash-text">
                    {formatMoney(recon.byMethod.cash.amount, currency)}
                  </p>
                </div>
              </div>
              {variance != null ? (
                <p
                  className={cn(
                    "mt-2 text-sm font-medium tabular-nums",
                    Math.abs(variance) < 0.005
                      ? "text-emerald-700"
                      : "text-rose-700",
                  )}
                >
                  {Math.abs(variance) < 0.005
                    ? "Balances ✓"
                    : `${variance > 0 ? "Over" : "Short"} by ${formatMoney(Math.abs(variance), currency)}`}
                </p>
              ) : null}
            </div>
          </>
        )}

        {unattributed && unattributed.count > 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {unattributed.count} payment
              {unattributed.count === 1 ? "" : "s"} (
              {formatMoney(unattributed.total, currency)}) taken today
              aren&rsquo;t tagged to a meeting. Open{" "}
              <Link
                href="/admin/payments"
                className="font-medium underline underline-offset-2"
              >
                Payments
              </Link>{" "}
              to check they belong to this evening.
            </span>
          </div>
        ) : null}

        <Button asChild variant="outline" size="sm" className="w-full">
          <Link href={reportHref} target="_blank">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Open treasurer&rsquo;s report
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatMoney(amount: number, currency = "GBP") {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `£${amount.toFixed(2)}`;
  }
}

/**
 * Money raised summary on the meeting detail page. Surfaces:
 *
 *   - The headline total raised for THIS meeting (succeeded only).
 *   - Pending top-up (in-flight QR + unsettled cash) — useful in the
 *     hours after a meeting before settlement.
 *   - Sub-amount breakdown so the treasurer can see how the total split
 *     across meeting fee / dining / charity / raffle / guest tickets.
 *   - A "take a payment for this meeting" CTA that deep-links to the
 *     take-payment app with the event pre-selected on the picker, so
 *     the duty officer doesn't have to remember to attach.
 *   - The lodge-wide all-time total, so anybody glancing at the meeting
 *     page sees a real-time picture of fundraising momentum.
 */
function MoneyRaisedCard({
  eventId,
  finance,
  meetingHasFees,
  enabled,
}: {
  eventId: string;
  finance: MeetingFinance;
  meetingHasFees: boolean;
  /**
   * Which fee buckets this meeting has switched on. When a bucket is
   * enabled we render its row even when nothing has been raised yet, so
   * the treasurer sees the stable list of categories and zeros instead
   * of a single £0.00 headline. When disabled the row stays hidden even
   * if a stray legacy payment carries an amount, to avoid implying the
   * meeting expects that money.
   */
  enabled: {
    meetingFee: boolean;
    dining: boolean;
    guestTicket: boolean;
    charity: boolean;
    raffle: boolean;
  };
}) {
  const { meeting, lodgeAllTime, currency } = finance;
  const hasMeetingActivity =
    meeting.succeededCount > 0 || meeting.pendingCount > 0;
  // Money taken against this meeting that wasn't tagged to a specific
  // bucket (take-payment / cash logged under "general" or any category the
  // meeting doesn't have switched on) lives only in total_amount. Surface
  // it as its own row so the treasurer can see where the rest of the
  // headline total went instead of it silently disappearing.
  const categorisedTotal =
    meeting.meetingFee +
    meeting.dining +
    meeting.guestTicket +
    meeting.charity +
    meeting.raffle;
  // succeededTotal is already net of refunds; the per-bucket figures are
  // gross, so clamp at zero to stay safe when a refund has been applied.
  const uncategorised = Math.max(0, meeting.succeededTotal - categorisedTotal);
  const breakdownAll: Array<[string, number, boolean]> = [
    ["Meeting fee", meeting.meetingFee, enabled.meetingFee],
    ["Dining", meeting.dining, enabled.dining],
    ["Guest tickets", meeting.guestTicket, enabled.guestTicket],
    ["Charity", meeting.charity, enabled.charity],
    ["Raffle", meeting.raffle, enabled.raffle],
    ["General", uncategorised, uncategorised > 0],
  ];
  // Show every bucket that is either enabled on the event OR has money
  // sitting against it (defensive against legacy data). This way the
  // treasurer sees Charity / Raffle / Dining / Levy etc. as soon as the
  // meeting toggles them on, even before the first payment lands.
  const breakdown: Array<[string, number]> = breakdownAll
    .filter(([, amount, isEnabled]) => isEnabled || amount > 0)
    .map(([label, amount]) => [label, amount]);

  const chargeHref = `/admin/take-payment?event_id=${encodeURIComponent(eventId)}&tab=charge`;
  const cashHref = `/admin/take-payment?event_id=${encodeURIComponent(eventId)}&tab=cash`;

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div className="flex items-center gap-2">
          <PoundSterling className="h-4 w-4 text-emerald-700" />
          <h3 className="dash-panel-header-title">Money raised</h3>
        </div>
      </div>
      <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-dash-muted">
            This meeting
          </p>
          <p className="mt-1 text-2xl font-semibold text-dash-text">
            {formatMoney(meeting.succeededTotal, currency)}
          </p>
          {meeting.pendingTotal > 0 ? (
            <p className="mt-0.5 text-xs text-amber-700">
              + {formatMoney(meeting.pendingTotal, currency)} pending (
              {meeting.pendingCount} unsettled)
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-dash-text-muted">
            {meeting.succeededCount} payment
            {meeting.succeededCount === 1 ? "" : "s"} settled
            {meeting.refunded > 0
              ? ` · ${formatMoney(meeting.refunded, currency)} refunded`
              : ""}
          </p>
        </div>

        {breakdown.length > 0 ? (
          <dl className="grid grid-cols-2 gap-2 border-t border-dash-border pt-3 text-xs">
            {breakdown.map(([label, value]) => (
              <div
                key={label}
                className="rounded-md border border-dash-border bg-dash-surface-subtle/40 px-2 py-1.5"
              >
                <dt className="text-dash-muted">{label}</dt>
                <dd className="font-semibold text-dash-text">
                  {formatMoney(value, currency)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {!hasMeetingActivity ? (
          <p className="rounded-md border border-dashed border-dash-border bg-dash-surface-subtle/40 px-3 py-2 text-xs text-dash-text-muted">
            {meetingHasFees
              ? "No payments yet. Online RSVPs and in-person collections will appear here as they come in."
              : "No payments yet. Use the buttons below to record charity, raffle, or guest-ticket money against this meeting."}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="primary" size="sm">
            <Link href={chargeHref}>
              <PoundSterling className="mr-1.5 h-3.5 w-3.5" />
              Take payment
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={cashHref}>Log cash</Link>
          </Button>
        </div>

        <div className="border-t border-dash-border pt-3">
          <p className="text-xs uppercase tracking-wide text-dash-muted">
            All-time lodge total
          </p>
          <p className="mt-1 text-base font-semibold text-dash-text">
            {formatMoney(lodgeAllTime, currency)}
          </p>
          <p className="mt-0.5 text-xs text-dash-text-muted">
            Across every settled or in-flight payment, all meetings.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
