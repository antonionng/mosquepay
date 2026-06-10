"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Save,
  Send,
  Trash2,
  User,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { MemberSubscriptionPanel } from "@/components/admin/member-subscription-panel";
import { MemberGiftAidPanel } from "@/components/admin/member-gift-aid-panel";
import {
  GivingMethodPanel,
  type GivingMethodPanelProps,
} from "@/components/admin/giving-method-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  RANK_CODES,
  RANK_LABELS,
  churchTitleFor,
  rankLabel,
} from "@/lib/members/rank";

interface Member {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  county: string | null;
  postcode: string | null;
  country: string | null;
  country_list: boolean;
  royal_arch: boolean;
  honorary: boolean;
  office_title: string | null;
  officer_sort_order: number | null;
  directory_sort_order: number | null;
  rank: string | null;
  dietary_requirements: string | null;
  member_levy_amount: number | null;
  member_dining_amount: number | null;
  levy_waived: boolean;
  dining_waived: boolean;
  fee_use_custom: boolean;
  annual_giving_waived: boolean;
  annual_giving_waiver_reason: string | null;
  date_of_membership: string | null;
  membership_email_sent: boolean;
  membership_status: string;
  stripe_customer_id: string | null;
  show_on_website: boolean;
  public_bio: string | null;
  gift_aid_consent_status: "unknown" | "declared" | "declined";
  created_at: string;
  updated_at: string;
}

interface DietaryEntry {
  event_id: string;
  dietary_requirements: string | null;
  created_at: string;
}

interface PaymentEntry {
  id: string;
  user_email: string;
  total_amount: number;
  currency: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  dining_amount: number;
  charity_amount: number;
  raffle_amount: number;
  service_fee_amount: number;
  guest_ticket_amount: number;
}

interface GivingEntry {
  id: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: string;
  paid_at: string | null;
  waiver_reason: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  suspended: "Suspended",
  resigned: "Resigned",
  excluded: "Excluded",
};

const STATUS_VARIANTS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  suspended: "bg-amber-50 text-amber-700 border-amber-200",
  resigned: "bg-slate-100 text-slate-600 border-slate-200",
  excluded: "bg-red-50 text-red-700 border-red-200",
};

const GIVING_VARIANTS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  outstanding: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  waived: "bg-slate-100 text-slate-600 border-slate-200",
};

interface OfficeRung {
  id: string;
  rung_label: string;
  sort_order: number;
  current_member_id: string | null;
}

interface NextGivingSummary {
  status:
    | "owed_current_year"
    | "billed_current_year"
    | "no_giving_year"
    | "no_giving_template"
    | "waived_at_profile";
  nextDueDate: string | null;
  nextYearLabel: string | null;
  expectedAmount: number | null;
  currentYearOutstanding: boolean;
  waiverReason?: string | null;
}

interface SubscriptionData {
  schedule: import("@/lib/db/types").GivingSchedule;
  instalments: import("@/lib/db/types").MemberGivingInstalment[];
}

interface Props {
  member: Member;
  dietaryHistory: DietaryEntry[];
  paymentHistory: PaymentEntry[];
  givingRecords: GivingEntry[];
  offices?: OfficeRung[];
  nextGiving: NextGivingSummary | null;
  subscription?: SubscriptionData | null;
  /** Active (non-revoked) Gift Aid declaration if one is on file for this
   *  member. Drives the post-service paper-upload panel. */
  giftAidDeclaration?: import("@/lib/db/types").GiftAidDeclaration | null;
  /** Initial state for the new Giving Method panel — current-year row,
   *  current method tag, copyable subscription link. Server-computed in
   *  page.tsx so the panel renders without a client roundtrip. */
  givingMethod?: GivingMethodPanelProps["initial"] | null;
  /** Last 10 emails LP sent to this member. Drives the "Recent emails"
   *  panel — best-effort log so admins can verify a notification went
   *  out without leaving the page. */
  recentEmails?: import("@/lib/db/types").EmailLog[] | null;
}

function buildEditForm(member: Member) {
  return {
    full_name: member.full_name,
    email: member.email,
    phone: member.phone ?? "",
    address_line_1: member.address_line_1 ?? "",
    address_line_2: member.address_line_2 ?? "",
    city: member.city ?? "",
    county: member.county ?? "",
    postcode: member.postcode ?? "",
    country: member.country ?? "United Kingdom",
    country_list: member.country_list,
    royal_arch: member.royal_arch,
    honorary: member.honorary,
    office_rung_ids: [] as string[],
    directory_sort_order: member.directory_sort_order?.toString() ?? "",
    rank: member.rank ?? "",
    dietary_requirements: member.dietary_requirements ?? "",
    fee_use_custom: member.fee_use_custom ?? false,
    member_levy_amount: member.member_levy_amount?.toString() ?? "",
    member_dining_amount: member.member_dining_amount?.toString() ?? "",
    levy_waived: member.levy_waived ?? false,
    dining_waived: member.dining_waived ?? false,
    annual_giving_waived: member.annual_giving_waived ?? false,
    annual_giving_waiver_reason: member.annual_giving_waiver_reason ?? "",
    date_of_membership: member.date_of_membership ?? "",
    membership_status: member.membership_status,
    show_on_website: member.show_on_website ?? false,
    public_bio: member.public_bio ?? "",
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: string) {
  return value ? Number(value) : null;
}

function formatAddress(member: Member) {
  return [
    member.address_line_1,
    member.address_line_2,
    member.city,
    member.county,
    member.postcode,
    member.country && member.country !== "United Kingdom" ? member.country : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function MemberDetailClient({
  member: initialMember,
  dietaryHistory,
  paymentHistory,
  givingRecords: initialGiving,
  offices: initialOffices = [],
  nextGiving,
  subscription = null,
  giftAidDeclaration = null,
  givingMethod = null,
  recentEmails = [],
}: Props) {
  const router = useRouter();
  const [member, setMember] = useState(initialMember);
  const [givingRecords, setGivingRecords] = useState(initialGiving);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [teamSending, setTeamSending] = useState(false);
  const [confirmTeamOpen, setConfirmTeamOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingGivingAction, setPendingGivingAction] = useState<{
    givingId: string;
    action: "waive" | "mark_paid" | "mark_outstanding";
  } | null>(null);
  const [givingActionLoading, setGivingActionLoading] = useState(false);
  const [givingWaiverNote, setGivingWaiverNote] = useState("");
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [pendingEmailChange, setPendingEmailChange] = useState<{
    from: string;
    to: string;
  } | null>(null);

  const offices = initialOffices;
  const currentRungIds = offices
    .filter((o) => o.current_member_id === member.id)
    .map((o) => o.id);

  function buildEditFormWithOffice(m: Member) {
    return {
      ...buildEditForm(m),
      office_rung_ids: offices
        .filter((o) => o.current_member_id === m.id)
        .map((o) => o.id),
    };
  }

  const [editForm, setEditForm] = useState(() => buildEditFormWithOffice(member));

  function handleSave() {
    const trimmedEmail = editForm.email.trim().toLowerCase();
    const emailChanged = trimmedEmail !== member.email.toLowerCase();
    if (emailChanged) {
      if (!EMAIL_RE.test(trimmedEmail)) {
        setFeedback({
          type: "error",
          message: "Enter a valid email address before saving.",
        });
        return;
      }
      setPendingEmailChange({ from: member.email, to: trimmedEmail });
      return;
    }
    void performSave({ includeEmail: false });
  }

  async function performSave({ includeEmail }: { includeEmail: boolean }) {
    setSaving(true);
    setFeedback(null);
    try {
      const body: Record<string, unknown> = {
        full_name: editForm.full_name,
        phone: emptyToNull(editForm.phone),
        address_line_1: emptyToNull(editForm.address_line_1),
        address_line_2: emptyToNull(editForm.address_line_2),
        city: emptyToNull(editForm.city),
        county: emptyToNull(editForm.county),
        postcode: emptyToNull(editForm.postcode),
        country: emptyToNull(editForm.country) ?? "United Kingdom",
        country_list: editForm.country_list,
        royal_arch: editForm.royal_arch,
        honorary: editForm.honorary,
        directory_sort_order: numberOrNull(editForm.directory_sort_order),
        rank: emptyToNull(editForm.rank),
        dietary_requirements: emptyToNull(editForm.dietary_requirements),
        fee_use_custom: editForm.fee_use_custom,
        member_levy_amount: editForm.fee_use_custom
          ? numberOrNull(editForm.member_levy_amount)
          : null,
        member_dining_amount: editForm.fee_use_custom
          ? numberOrNull(editForm.member_dining_amount)
          : null,
        levy_waived: editForm.levy_waived,
        dining_waived: editForm.dining_waived,
        annual_giving_waived: editForm.annual_giving_waived,
        annual_giving_waiver_reason: editForm.annual_giving_waived
          ? emptyToNull(editForm.annual_giving_waiver_reason)
          : null,
        date_of_membership: editForm.date_of_membership || null,
        membership_status: editForm.membership_status,
        show_on_website: editForm.show_on_website,
        public_bio: editForm.show_on_website
          ? emptyToNull(editForm.public_bio)
          : null,
      };
      if (includeEmail) {
        body.email = editForm.email.trim().toLowerCase();
      }
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save member.");
      }

      const previous = new Set(currentRungIds);
      const next = new Set(editForm.office_rung_ids);
      const toClear = [...previous].filter((id) => !next.has(id));
      const toAssign = [...next].filter((id) => !previous.has(id));
      await Promise.all([
        ...toClear.map((id) =>
          fetch(`/api/members/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_member_id: null }),
          })
        ),
        ...toAssign.map((id) =>
          fetch(`/api/members/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ current_member_id: member.id }),
          })
        ),
      ]);

      setMember(data.member);
      setEditForm(buildEditFormWithOffice(data.member));
      setEditing(false);
      setPendingEmailChange(null);
      const change = data.email_change as
        | {
            payments_updated?: number;
            rsvps_updated?: number;
            giving_updated?: number;
            auth_user_updated?: boolean;
            stripe_customer_updated?: boolean;
            warnings?: string[];
          }
        | undefined;
      if (change) {
        const parts: string[] = ["Member profile saved."];
        const counts: string[] = [];
        if ((change.payments_updated ?? 0) > 0) {
          counts.push(`${change.payments_updated} payment(s)`);
        }
        if ((change.rsvps_updated ?? 0) > 0) {
          counts.push(`${change.rsvps_updated} RSVP(s)`);
        }
        if ((change.giving_updated ?? 0) > 0) {
          counts.push(`${change.giving_updated} giving record(s)`);
        }
        if (counts.length > 0) {
          parts.push(`Re-linked ${counts.join(", ")}.`);
        }
        if (change.auth_user_updated) {
          parts.push("Portal login email updated.");
        }
        if (change.stripe_customer_updated) {
          parts.push("Stripe customer updated.");
        }
        if (change.warnings && change.warnings.length > 0) {
          parts.push(...change.warnings);
        }
        setFeedback({ type: "success", message: parts.join(" ") });
      } else {
        setFeedback({ type: "success", message: "Member profile saved." });
      }
      router.refresh();
    } catch (saveError) {
      setFeedback({
        type: "error",
        message: saveError instanceof Error ? saveError.message : "Could not save member.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleResendInitiation() {
    setFeedback(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membership_email_sent: false }),
      });
      if (!res.ok) {
        throw new Error("Could not queue membership email.");
      }
      setFeedback({ type: "success", message: "Initiation email queued for the next cron run." });
      router.refresh();
    } catch (emailError) {
      setFeedback({
        type: "error",
        message: emailError instanceof Error ? emailError.message : "Could not queue membership email.",
      });
    }
  }

  async function handleRemoveMember() {
    setRemoving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            "Could not remove member."
        );
      }
      setConfirmRemoveOpen(false);
      router.push("/admin/members");
      router.refresh();
    } catch (removeError) {
      setFeedback({
        type: "error",
        message:
          removeError instanceof Error
            ? removeError.message
            : "Could not remove member.",
      });
      setRemoving(false);
    }
  }

  async function handleSendPortalInvite() {
    setInviteSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/members/${member.id}/invite`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send portal invite.");
      }
      setFeedback({
        type: "success",
        message: `Member portal invite sent to ${member.email}.`,
      });
      router.refresh();
    } catch (inviteError) {
      setFeedback({
        type: "error",
        message:
          inviteError instanceof Error
            ? inviteError.message
            : "Could not send portal invite.",
      });
    } finally {
      setInviteSending(false);
    }
  }

  async function handleMakeTeamMember() {
    setTeamSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/members/${member.id}/make-team-member`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not grant payment access.");
      }
      setConfirmTeamOpen(false);
      setFeedback({
        type: "success",
        message: `${member.full_name} can now take payments. A confirmation email was sent to ${member.email}.`,
      });
      router.refresh();
    } catch (teamError) {
      setFeedback({
        type: "error",
        message:
          teamError instanceof Error
            ? teamError.message
            : "Could not grant payment access.",
      });
    } finally {
      setTeamSending(false);
    }
  }

  async function handleGivingAction(
    givingId: string,
    action: "waive" | "mark_paid" | "mark_outstanding"
  ) {
    setGivingActionLoading(true);
    setFeedback(null);
    try {
      const trimmedNote = givingWaiverNote.trim();
      const res = await fetch("/api/giving", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          giving_id: givingId,
          ...(action === "waive" && trimmedNote
            ? { waiver_reason: trimmedNote }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.giving) {
        throw new Error(data.error ?? "Could not update giving.");
      }
      setGivingRecords((prev) =>
        prev.map((d) => (d.id === givingId ? data.giving : d))
      );
      setFeedback({ type: "success", message: "Giving record updated." });
      setPendingGivingAction(null);
      setGivingWaiverNote("");
    } catch (givingError) {
      setFeedback({
        type: "error",
        message: givingError instanceof Error ? givingError.message : "Could not update giving.",
      });
    } finally {
      setGivingActionLoading(false);
    }
  }

  const pendingGivingRecord = pendingGivingAction
    ? givingRecords.find((giving) => giving.id === pendingGivingAction.givingId)
    : null;
  const givingActionCopy = pendingGivingAction
    ? {
        mark_paid: {
          title: "Mark giving as paid?",
          description: "This updates the member giving record and records the action in the audit trail.",
          confirmLabel: "Mark paid",
          tone: "success" as const,
        },
        waive: {
          title: "Waive giving?",
          description: "This marks the giving as waived. Use this only when the church has agreed the member does not need to pay this period.",
          confirmLabel: "Waive giving",
          tone: "danger" as const,
        },
        mark_outstanding: {
          title: "Reopen giving?",
          description: "This makes the giving outstanding again so the member can pay or be chased by the treasurer.",
          confirmLabel: "Reopen giving",
          tone: "default" as const,
        },
      }[pendingGivingAction.action]
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/members" className="flex items-center gap-1.5 text-dash-muted">
            <ArrowLeft className="h-4 w-4" />
            Members
          </Link>
        </Button>
        {!editing && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setConfirmRemoveOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Remove member
          </Button>
        )}
      </div>

      {feedback && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm",
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {feedback.message}
        </div>
      )}

      <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4 bg-dash-surface-subtle">
          <h2 className="text-base font-semibold text-dash-text flex items-center gap-2">
            <User className="h-4 w-4 text-dash-muted" />
            Profile
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
                STATUS_VARIANTS[member.membership_status] ?? STATUS_VARIANTS.active
              )}
            >
              {STATUS_LABELS[member.membership_status] ?? member.membership_status}
            </span>
            {!editing && (
              <Button
                variant="dashboard"
                size="sm"
                onClick={handleSendPortalInvite}
                disabled={inviteSending}
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                {inviteSending
                  ? "Sending..."
                  : member.auth_user_id
                    ? "Resend portal invite"
                    : "Send portal invite"}
              </Button>
            )}
            {!editing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmTeamOpen(true)}
                disabled={teamSending}
              >
                <Wallet className="h-3.5 w-3.5 mr-1" />
                {teamSending ? "Sending..." : "Make payment team member"}
              </Button>
            )}
            {!editing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditForm(buildEditForm(member));
                    setEditing(true);
                  }}
                >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditForm(buildEditForm(member));
                    setEditing(false);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="p-6">
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                />
                <p className="text-xs text-dash-muted">
                  Changing this updates the member&apos;s portal login,
                  Stripe customer, and re-links their payments, RSVPs, and
                  giving history. You&apos;ll be asked to confirm before
                  saving.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address line 1</Label>
                <Input
                  value={editForm.address_line_1}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address_line_1: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Address line 2</Label>
                <Input
                  value={editForm.address_line_2}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address_line_2: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>County</Label>
                <Input
                  value={editForm.county}
                  onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input
                  value={editForm.postcode}
                  onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Rank</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                  value={editForm.rank}
                  onChange={(e) => setEditForm({ ...editForm, rank: e.target.value })}
                >
                  <option value="">Select...</option>
                  {RANK_CODES.map((code) => (
                    <option key={code} value={code}>
                      {RANK_LABELS[code]}
                    </option>
                  ))}
                </select>
                {editForm.rank && churchTitleFor(editForm.rank) && (
                  <p className="text-xs text-dash-muted">
                    Church title:{" "}
                    <span className="font-medium text-dash-text">
                      {churchTitleFor(editForm.rank)}
                    </span>{" "}
                    (derived automatically from rank)
                  </p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Offices held</Label>
                <p className="text-xs text-dash-muted">
                  Tick every office this member currently holds. Leave all
                  unticked if he holds no office.
                </p>
                <div className="grid max-h-72 grid-cols-1 gap-1 overflow-y-auto rounded-xl border border-dash-border bg-dash-surface p-3 sm:grid-cols-2">
                  {[...offices]
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((office) => {
                      const checked = editForm.office_rung_ids.includes(office.id);
                      const heldByOther =
                        office.current_member_id !== null &&
                        office.current_member_id !== member.id;
                      return (
                        <label
                          key={office.id}
                          className={cn(
                            "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-dash-surface-subtle",
                            checked && "bg-blue-50 hover:bg-blue-50"
                          )}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-dash-border"
                            checked={checked}
                            onChange={(e) => {
                              const set = new Set(editForm.office_rung_ids);
                              if (e.target.checked) set.add(office.id);
                              else set.delete(office.id);
                              setEditForm({
                                ...editForm,
                                office_rung_ids: [...set],
                              });
                            }}
                          />
                          <span className="flex-1">
                            <span className="font-medium text-dash-text">
                              {office.rung_label}
                            </span>
                            {heldByOther && !checked ? (
                              <span className="ml-1 text-xs text-amber-700">
                                (ticking this will move it from current holder)
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Directory order</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.directory_sort_order}
                  onChange={(e) =>
                    setEditForm({ ...editForm, directory_sort_order: e.target.value })
                  }
                />
              </div>
              <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 sm:col-span-2">
                <p className="text-sm font-medium text-dash-text">Notice directory flags</p>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={editForm.royal_arch}
                    onChange={(e) =>
                      setEditForm({ ...editForm, royal_arch: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Royal Arch member
                </label>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={editForm.country_list}
                    onChange={(e) =>
                      setEditForm({ ...editForm, country_list: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Country List member
                </label>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={editForm.honorary}
                    onChange={(e) =>
                      setEditForm({ ...editForm, honorary: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Honorary member
                </label>
              </div>
              <div className="space-y-2">
                <Label>Dietary requirements & allergies</Label>
                <Input
                  value={editForm.dietary_requirements}
                  onChange={(e) => setEditForm({ ...editForm, dietary_requirements: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2 space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div>
                  <p className="text-sm font-medium text-dash-text">
                    Public website
                  </p>
                  <p className="mt-1 text-xs text-dash-muted">
                    Per-member opt-in. When on, this member can be rendered on
                    the public Officers section of the church website if they
                    hold an office. Off by default; revocable at any time.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-sm font-medium text-dash-text">
                  <input
                    type="checkbox"
                    checked={editForm.show_on_website}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        show_on_website: e.target.checked,
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-dash-border"
                  />
                  <span>
                    Show this member on the public church website
                    <span className="block text-xs font-normal text-dash-muted">
                      Requires the member&apos;s explicit consent. Their name,
                      rank, and bio below appear on the Officers section only
                      when ticked.
                    </span>
                  </span>
                </label>
                {editForm.show_on_website ? (
                  <div className="space-y-2">
                    <Label>Public bio (optional)</Label>
                    <Textarea
                      rows={4}
                      maxLength={800}
                      placeholder="A short paragraph for the public Officers section."
                      value={editForm.public_bio}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          public_bio: e.target.value,
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
              <div className="sm:col-span-2 space-y-3 rounded-xl border border-dash-border p-4">
                <p className="text-sm font-medium text-dash-text">Fees & dining</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={!editForm.fee_use_custom}
                    onChange={() => setEditForm({ ...editForm, fee_use_custom: false })}
                  />
                  Use church defaults
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={editForm.fee_use_custom}
                    onChange={() => setEditForm({ ...editForm, fee_use_custom: true })}
                  />
                  Custom for this member
                </label>
                {editForm.fee_use_custom && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Service levy (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.member_levy_amount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, member_levy_amount: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dining (£)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.member_dining_amount}
                        onChange={(e) =>
                          setEditForm({ ...editForm, member_dining_amount: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.levy_waived}
                    onChange={(e) =>
                      setEditForm({ ...editForm, levy_waived: e.target.checked })
                    }
                  />
                  Levy waived
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.dining_waived}
                    onChange={(e) =>
                      setEditForm({ ...editForm, dining_waived: e.target.checked })
                    }
                  />
                  Dines complimentary
                </label>
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-amber-900">
                    <input
                      type="checkbox"
                      checked={editForm.annual_giving_waived}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          annual_giving_waived: e.target.checked,
                          annual_giving_waiver_reason: e.target.checked
                            ? editForm.annual_giving_waiver_reason
                            : "",
                        })
                      }
                    />
                    Annual giving waived
                  </label>
                  <p className="text-xs text-amber-800">
                    Treats this member as exempt from the church&apos;s annual
                    giving bill. The next giving panel and bulk giving run will
                    skip them until this is turned off.
                  </p>
                  {editForm.annual_giving_waived && (
                    <Textarea
                      rows={2}
                      placeholder="Reason for the waiver (e.g. long service, ill health, church resolution)"
                      value={editForm.annual_giving_waiver_reason}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          annual_giving_waiver_reason: e.target.value,
                        })
                      }
                      maxLength={500}
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date of membership</Label>
                <Input
                  type="date"
                  value={editForm.date_of_membership}
                  onChange={(e) => setEditForm({ ...editForm, date_of_membership: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                  value={editForm.membership_status}
                  onChange={(e) => setEditForm({ ...editForm, membership_status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="resigned">Resigned</option>
                  <option value="excluded">Excluded</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <User className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Full name</p>
                  <p className="text-sm font-medium text-dash-text">{member.full_name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Email</p>
                  <p className="text-sm font-medium text-dash-text">{member.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Phone</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.phone ?? "Not recorded"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 lg:col-span-2">
                <Mail className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Notice directory address</p>
                  <p className="text-sm font-medium text-dash-text">
                    {formatAddress(member) || "Not recorded"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Rank</p>
                  <p className="text-sm font-medium text-dash-text">
                    {rankLabel(member.rank) ?? "Not recorded"}
                  </p>
                  {churchTitleFor(member.rank) && (
                    <p className="text-xs text-dash-muted">
                      Church title: {churchTitleFor(member.rank)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Office</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.office_title ?? "Not an officer"}
                  </p>
                  <Link
                    href="/admin/members?tab=offices"
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Manage all offices
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Directory flags</p>
                  <p className="text-sm font-medium text-dash-text">
                    {[
                      member.royal_arch ? "RA" : null,
                      member.country_list ? "Country List" : null,
                      member.honorary ? "Honorary" : null,
                    ]
                      .filter(Boolean)
                      .join(", ") || "None"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <UtensilsCrossed className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Dietary requirements & allergies</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.dietary_requirements ?? "None specified"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Wallet className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Fees & dining</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.dining_waived
                      ? "Dines complimentary"
                      : member.fee_use_custom
                        ? `Custom levy${member.member_levy_amount != null ? ` £${member.member_levy_amount}` : ""}, dining${member.member_dining_amount != null ? ` £${member.member_dining_amount}` : " per church default"}`
                        : "Church defaults"}
                    {member.levy_waived ? " · Levy waived" : ""}
                  </p>
                  {member.annual_giving_waived && (
                    <div className="mt-1 inline-flex max-w-full flex-col rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      <span className="font-semibold">Annual giving waived</span>
                      {member.annual_giving_waiver_reason && (
                        <span className="italic text-amber-700">
                          {member.annual_giving_waiver_reason}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Date of membership</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.date_of_membership
                      ? new Date(member.date_of_membership).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "Not set"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {!editing && member.date_of_membership && !member.membership_email_sent && (
          <div className="border-t border-dash-border px-6 py-3 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                Initiation email has not been sent yet.
              </p>
              <Button variant="ghost" size="sm" onClick={handleResendInitiation}>
                <Send className="h-3.5 w-3.5 mr-1" />
                Mark for sending
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
          <div className="border-b border-dash-border px-6 py-4">
            <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-dash-muted" />
              Dietary History (from RSVPs)
            </h3>
          </div>
          <div className="divide-y divide-dash-border">
            {dietaryHistory.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <UtensilsCrossed className="h-8 w-8 text-dash-faint mb-2" />
                <p className="text-sm text-dash-muted">No dietary requirements recorded from events</p>
              </div>
            ) : (
              dietaryHistory.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-6 py-3.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dash-text">
                      {entry.dietary_requirements}
                    </p>
                    <p className="text-xs text-dash-muted flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {subscription ? (
          <MemberSubscriptionPanel
            schedule={subscription.schedule}
            instalments={subscription.instalments}
            memberName={member.full_name}
          />
        ) : null}

        {givingMethod ? (
          <GivingMethodPanel
            memberId={member.id}
            memberEmail={member.email}
            memberName={member.full_name}
            initial={givingMethod}
          />
        ) : null}

        <RecentEmailsPanel emails={recentEmails ?? []} />

        <MemberGiftAidPanel
          member={{
            id: member.id,
            full_name: member.full_name,
            email: member.email,
            address_line_1: member.address_line_1 ?? null,
            address_line_2: member.address_line_2 ?? null,
            city: member.city ?? null,
            postcode: member.postcode ?? null,
            gift_aid_consent_status: member.gift_aid_consent_status ?? "unknown",
          }}
          declaration={
            giftAidDeclaration
              ? {
                  id: giftAidDeclaration.id,
                  donor_name: giftAidDeclaration.donor_name,
                  donor_email: giftAidDeclaration.donor_email,
                  donor_address_line_1: giftAidDeclaration.donor_address_line_1,
                  donor_postcode: giftAidDeclaration.donor_postcode,
                  created_at: giftAidDeclaration.created_at,
                  evidence_source: giftAidDeclaration.evidence_source,
                  evidence_sha256: giftAidDeclaration.evidence_sha256,
                  evidence_uploaded_at: giftAidDeclaration.evidence_uploaded_at,
                  evidence_uploaded_by_email:
                    giftAidDeclaration.evidence_uploaded_by_email,
                  paper_received_date: giftAidDeclaration.paper_received_date,
                  paper_filing_reference:
                    giftAidDeclaration.paper_filing_reference,
                  revoked_at: giftAidDeclaration.revoked_at,
                }
              : null
          }
        />

        <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
          <div className="border-b border-dash-border px-6 py-4">
            <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
              <Wallet className="h-4 w-4 text-dash-muted" />
              Membership Giving
            </h3>
          </div>
          {nextGiving && (
            <div
              className={cn(
                "border-b border-dash-border px-6 py-4",
                nextGiving.status === "owed_current_year"
                  ? "bg-amber-50/60"
                  : "bg-slate-50/60"
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-dash-muted">
                Next giving
              </p>
              {nextGiving.status === "waived_at_profile" ? (
                <p className="mt-1 text-sm text-dash-text">
                  <span className="font-semibold">Annual giving waived.</span>{" "}
                  Bulk giving runs and next-due reminders will skip this member
                  until the waiver is removed from their profile.
                  {nextGiving.waiverReason && (
                    <span className="ml-1 italic text-slate-500">
                      Reason: {nextGiving.waiverReason}
                    </span>
                  )}
                </p>
              ) : nextGiving.status === "no_giving_year" ? (
                <p className="mt-1 text-sm text-dash-text">
                  No giving year configured.{" "}
                  <Link
                    href="/admin/treasurer"
                    className="underline hover:text-dash-ring"
                  >
                    Set one in Treasurer
                  </Link>{" "}
                  to drive next due dates.
                </p>
              ) : nextGiving.status === "owed_current_year" ? (
                <p className="mt-1 text-sm text-dash-text">
                  <span className="font-semibold">
                    Owed for {nextGiving.nextYearLabel ?? "the current year"}
                  </span>
                  {nextGiving.nextDueDate && (
                    <>
                      {" "}— due from{" "}
                      <span className="font-medium">
                        {new Date(nextGiving.nextDueDate).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "long", year: "numeric" }
                        )}
                      </span>
                    </>
                  )}
                  {nextGiving.expectedAmount != null && (
                    <> at £{nextGiving.expectedAmount.toFixed(2)}</>
                  )}
                  . Not yet billed.
                </p>
              ) : (
                <p className="mt-1 text-sm text-dash-text">
                  Next bill ({nextGiving.nextYearLabel ?? "next year"}) falls due{" "}
                  <span className="font-medium">
                    {nextGiving.nextDueDate
                      ? new Date(nextGiving.nextDueDate).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "long", year: "numeric" }
                        )
                      : "next year"}
                  </span>
                  {nextGiving.expectedAmount != null && (
                    <> at £{nextGiving.expectedAmount.toFixed(2)}</>
                  )}
                  .
                  {nextGiving.currentYearOutstanding && (
                    <span className="ml-1 text-amber-700">
                      Current year still outstanding.
                    </span>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="divide-y divide-dash-border">
            {givingRecords.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Wallet className="h-8 w-8 text-dash-faint mb-2" />
                <p className="text-sm text-dash-muted">No giving records</p>
              </div>
            ) : (
              givingRecords.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-6 py-3.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      d.status === "paid" ? "bg-emerald-50" : "bg-amber-50"
                    )}
                  >
                    {d.status === "paid" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dash-text">
                      £{d.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-dash-muted">
                      {new Date(d.period_start).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}{" "}
                      –{" "}
                      {new Date(d.period_end).toLocaleDateString("en-GB", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {d.status === "waived" && d.waiver_reason && (
                      <p className="mt-1 text-xs italic text-slate-500">
                        Reason: {d.waiver_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                        GIVING_VARIANTS[d.status] ?? GIVING_VARIANTS.outstanding
                      )}
                    >
                      {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                    </span>
                    {d.status !== "paid" && (
                      <button
                        onClick={() =>
                          setPendingGivingAction({ givingId: d.id, action: "mark_paid" })
                        }
                        className="text-xs text-dash-muted underline hover:text-dash-text"
                      >
                        Mark paid
                      </button>
                    )}
                    {d.status === "outstanding" && (
                      <button
                        onClick={() =>
                          setPendingGivingAction({ givingId: d.id, action: "waive" })
                        }
                        className="text-xs text-dash-muted underline hover:text-dash-text"
                      >
                        Waive
                      </button>
                    )}
                    {d.status !== "outstanding" && (
                      <button
                        onClick={() =>
                          setPendingGivingAction({ givingId: d.id, action: "mark_outstanding" })
                        }
                        className="text-xs text-dash-muted underline hover:text-dash-text"
                      >
                        Reopen
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
        <div className="border-b border-dash-border px-6 py-4">
          <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-dash-muted" />
            Payment History
          </h3>
        </div>
        <div className="overflow-x-auto">
          {paymentHistory.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CreditCard className="h-8 w-8 text-dash-faint mb-2" />
              <p className="text-sm text-dash-muted">No payments recorded</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs font-medium uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3 hidden md:table-cell">Dining</th>
                  <th className="px-4 py-3 hidden md:table-cell">Charity</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {paymentHistory.map((p) => (
                  <tr key={p.id} className="hover:bg-dash-surface-subtle transition-colors">
                    <td className="px-4 py-3.5 text-dash-muted">
                      {new Date(p.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-dash-text">
                      £{p.total_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden md:table-cell">
                      £{p.dining_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden md:table-cell">
                      £{p.charity_amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                          p.status === "succeeded"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : p.status === "refunded"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                        )}
                      >
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {pendingGivingAction && givingActionCopy && pendingGivingAction.action !== "waive" && (
        <ConfirmActionDialog
          open={Boolean(pendingGivingAction)}
          onOpenChange={(open) => {
            if (!open) setPendingGivingAction(null);
          }}
          title={givingActionCopy.title}
          description={`${givingActionCopy.description} Amount: £${(pendingGivingRecord?.amount ?? 0).toFixed(2)}.`}
          confirmLabel={givingActionCopy.confirmLabel}
          loading={givingActionLoading}
          tone={givingActionCopy.tone}
          onConfirm={() =>
            handleGivingAction(pendingGivingAction.givingId, pendingGivingAction.action)
          }
        />
      )}

      {pendingGivingAction?.action === "waive" && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (givingActionLoading) return;
            if (!open) {
              setPendingGivingAction(null);
              setGivingWaiverNote("");
            }
          }}
        >
          <DialogContent
            showClose={!givingActionLoading}
            className="border-dash-border bg-dash-surface p-0 text-dash-text shadow-2xl"
          >
            <DialogHeader className="space-y-3 border-b border-dash-border px-6 py-5 text-left">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-dash-text">
                  Waive giving?
                </DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-6 text-dash-muted">
                  Marks the £
                  {(pendingGivingRecord?.amount ?? 0).toFixed(2)} giving record as
                  waived. The note is optional but recommended for the audit
                  trail and is shown in the treasurer ledger.
                </DialogDescription>
              </div>
            </DialogHeader>
            <div className="space-y-2 px-6 py-4">
              <Label htmlFor="giving-waiver-note">Waiver reason (optional)</Label>
              <Textarea
                id="giving-waiver-note"
                rows={3}
                placeholder="e.g. Long service, ill health, board approval 12 May."
                value={givingWaiverNote}
                onChange={(event) => setGivingWaiverNote(event.target.value)}
                maxLength={500}
                disabled={givingActionLoading}
              />
              <p className="text-xs text-dash-muted">
                {givingWaiverNote.length}/500
              </p>
            </div>
            <DialogFooter className="gap-2 border-t border-dash-border px-6 py-4 sm:justify-end [&_button]:w-full sm:[&_button]:w-auto">
              <Button
                type="button"
                variant="secondary"
                disabled={givingActionLoading}
                onClick={() => {
                  setPendingGivingAction(null);
                  setGivingWaiverNote("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={givingActionLoading}
                onClick={() =>
                  handleGivingAction(pendingGivingAction.givingId, "waive")
                }
              >
                {givingActionLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Waive giving
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmActionDialog
        open={confirmTeamOpen}
        onOpenChange={(open) => {
          if (!teamSending) setConfirmTeamOpen(open);
        }}
        title={`Let ${member.full_name} take payments?`}
        description={`This gives ${member.full_name} treasurer-level admin access (payments, giving, and the in-person Take payment screen) for this church and emails ${member.email} a link to set their password and sign in. They can take payments once they accept.`}
        confirmLabel="Grant access & email"
        loading={teamSending}
        onConfirm={handleMakeTeamMember}
      />

      <ConfirmActionDialog
        open={confirmRemoveOpen}
        onOpenChange={(open) => {
          if (!removing) setConfirmRemoveOpen(open);
        }}
        title={`Remove ${member.full_name}?`}
        description="The member will be marked as Excluded and removed from active membership. Their record, payment history, and audit trail are kept for compliance."
        confirmLabel="Remove member"
        loading={removing}
        tone="danger"
        onConfirm={handleRemoveMember}
      />

      <ConfirmActionDialog
        open={Boolean(pendingEmailChange)}
        onOpenChange={(open) => {
          if (saving) return;
          if (!open) setPendingEmailChange(null);
        }}
        title="Change member email?"
        description={
          pendingEmailChange
            ? `This will change ${member.full_name}'s email from ${pendingEmailChange.from} to ${pendingEmailChange.to}. The new address becomes their portal login, the Stripe customer is updated, and their historical payments, RSVPs, and giving records get re-linked to the new email. They may need to sign in again.`
            : ""
        }
        confirmLabel="Change email"
        loading={saving}
        tone="danger"
        onConfirm={() => performSave({ includeEmail: true })}
      />
    </div>
  );
}

function emailTypeLabel(type: string): string {
  switch (type) {
    case "giving_subscription_activated_member":
      return "Subscription activated";
    case "giving_subscription_invoice_paid_member":
      return "Subscription cycle receipt";
    case "giving_subscription_invoice_failed_member":
      return "Subscription cycle failed";
    case "giving_subscription_canceled_member":
      return "Subscription cancelled";
    case "giving_method_changed_bacs_member":
      return "BACS recorded";
    case "giving_method_changed_paid_in_full_member":
      return "Paid in full";
    case "giving_method_changed_fee_waived_member":
      return "Fee waived";
    case "payment_receipt_giving_full":
      return "Giving receipt";
    case "payment_receipt_donation":
      return "Donation receipt";
    case "payment_receipt_event":
      return "Event receipt";
    default:
      return type.replaceAll("_", " ");
  }
}

function RecentEmailsPanel({
  emails,
}: {
  emails: import("@/lib/db/types").EmailLog[];
}) {
  return (
    <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
      <div className="border-b border-dash-border px-6 py-4">
        <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
          <Mail className="h-4 w-4 text-dash-muted" />
          Recent emails
        </h3>
        <p className="mt-1 text-xs text-dash-muted">
          The last 10 emails LP sent to this member. Failed sends are
          flagged so the treasurer can intervene.
        </p>
      </div>
      <div className="overflow-x-auto">
        {emails.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Mail className="h-8 w-8 text-dash-faint mb-2" />
            <p className="text-sm text-dash-muted">No emails sent yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs font-medium uppercase tracking-wider text-dash-muted">
                <th className="px-4 py-3">Sent</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3 hidden md:table-cell">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {emails.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-dash-surface-subtle transition-colors"
                >
                  <td className="px-4 py-3.5 text-dash-muted whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3.5 text-dash-text">
                    {emailTypeLabel(e.email_type)}
                  </td>
                  <td className="px-4 py-3.5 text-dash-muted hidden md:table-cell">
                    {e.subject}
                  </td>
                  <td className="px-4 py-3.5">
                    {e.status === "sent" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Sent
                      </span>
                    ) : e.status === "failed" ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700"
                        title={e.error ?? undefined}
                      >
                        <AlertCircle className="h-3 w-3" /> Failed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <AlertTriangle className="h-3 w-3" /> Skipped
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
