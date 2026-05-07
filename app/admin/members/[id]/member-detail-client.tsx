"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Calendar,
  UtensilsCrossed,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Send,
  Wallet,
  Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { cn } from "@/lib/utils";

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
  date_of_initiation: string | null;
  initiation_email_sent: boolean;
  membership_status: string;
  stripe_customer_id: string | null;
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
  meeting_fee_amount: number;
  guest_ticket_amount: number;
}

interface DuesEntry {
  id: string;
  amount: number;
  currency: string;
  period_start: string;
  period_end: string;
  status: string;
  paid_at: string | null;
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

const DUES_VARIANTS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  outstanding: "bg-amber-50 text-amber-700 border-amber-200",
  overdue: "bg-red-50 text-red-700 border-red-200",
  waived: "bg-slate-100 text-slate-600 border-slate-200",
};

interface Props {
  member: Member;
  dietaryHistory: DietaryEntry[];
  paymentHistory: PaymentEntry[];
  duesRecords: DuesEntry[];
}

function buildEditForm(member: Member) {
  return {
    full_name: member.full_name,
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
    office_title: member.office_title ?? "",
    officer_sort_order: member.officer_sort_order?.toString() ?? "",
    directory_sort_order: member.directory_sort_order?.toString() ?? "",
    rank: member.rank ?? "",
    dietary_requirements: member.dietary_requirements ?? "",
    date_of_initiation: member.date_of_initiation ?? "",
    membership_status: member.membership_status,
  };
}

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
  duesRecords: initialDues,
}: Props) {
  const router = useRouter();
  const [member, setMember] = useState(initialMember);
  const [duesRecords, setDuesRecords] = useState(initialDues);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inviteSending, setInviteSending] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingDuesAction, setPendingDuesAction] = useState<{
    duesId: string;
    action: "waive" | "mark_paid" | "mark_outstanding";
  } | null>(null);
  const [duesActionLoading, setDuesActionLoading] = useState(false);

  const [editForm, setEditForm] = useState(() => buildEditForm(member));

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          office_title: emptyToNull(editForm.office_title),
          officer_sort_order: numberOrNull(editForm.officer_sort_order),
          directory_sort_order: numberOrNull(editForm.directory_sort_order),
          rank: emptyToNull(editForm.rank),
          dietary_requirements: emptyToNull(editForm.dietary_requirements),
          date_of_initiation: editForm.date_of_initiation || null,
          membership_status: editForm.membership_status,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not save member.");
      }
      setMember(data.member);
      setEditForm(buildEditForm(data.member));
      setEditing(false);
      setFeedback({ type: "success", message: "Member profile saved." });
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
        body: JSON.stringify({ initiation_email_sent: false }),
      });
      if (!res.ok) {
        throw new Error("Could not queue initiation email.");
      }
      setFeedback({ type: "success", message: "Initiation email queued for the next cron run." });
      router.refresh();
    } catch (emailError) {
      setFeedback({
        type: "error",
        message: emailError instanceof Error ? emailError.message : "Could not queue initiation email.",
      });
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

  async function handleDuesAction(
    duesId: string,
    action: "waive" | "mark_paid" | "mark_outstanding"
  ) {
    setDuesActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, dues_id: duesId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.dues) {
        throw new Error(data.error ?? "Could not update dues.");
      }
      setDuesRecords((prev) =>
        prev.map((d) => (d.id === duesId ? data.dues : d))
      );
      setFeedback({ type: "success", message: "Dues record updated." });
      setPendingDuesAction(null);
    } catch (duesError) {
      setFeedback({
        type: "error",
        message: duesError instanceof Error ? duesError.message : "Could not update dues.",
      });
    } finally {
      setDuesActionLoading(false);
    }
  }

  const pendingDuesRecord = pendingDuesAction
    ? duesRecords.find((dues) => dues.id === pendingDuesAction.duesId)
    : null;
  const duesActionCopy = pendingDuesAction
    ? {
        mark_paid: {
          title: "Mark dues as paid?",
          description: "This updates the member dues record and records the action in the audit trail.",
          confirmLabel: "Mark paid",
          tone: "success" as const,
        },
        waive: {
          title: "Waive dues?",
          description: "This marks the dues as waived. Use this only when the lodge has agreed the member does not need to pay this period.",
          confirmLabel: "Waive dues",
          tone: "danger" as const,
        },
        mark_outstanding: {
          title: "Reopen dues?",
          description: "This makes the dues outstanding again so the member can pay or be chased by the treasurer.",
          confirmLabel: "Reopen dues",
          tone: "default" as const,
        },
      }[pendingDuesAction.action]
    : null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/members" className="flex items-center gap-1.5 text-dash-muted">
            <ArrowLeft className="h-4 w-4" />
            Members
          </Link>
        </Button>
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
                <Input value={member.email} disabled className="bg-dash-surface-subtle cursor-not-allowed" />
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
                  <option value="EA">Entered Apprentice</option>
                  <option value="FC">Fellow Craft</option>
                  <option value="MM">Master Mason</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Office title</Label>
                <Input
                  placeholder="e.g. Worshipful Master"
                  value={editForm.office_title}
                  onChange={(e) =>
                    setEditForm({ ...editForm, office_title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Officer order</Label>
                <Input
                  type="number"
                  min="0"
                  value={editForm.officer_sort_order}
                  onChange={(e) =>
                    setEditForm({ ...editForm, officer_sort_order: e.target.value })
                  }
                />
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
                <p className="text-sm font-medium text-dash-text">Summons directory flags</p>
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
                <Label>Dietary requirements</Label>
                <Input
                  value={editForm.dietary_requirements}
                  onChange={(e) => setEditForm({ ...editForm, dietary_requirements: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of initiation</Label>
                <Input
                  type="date"
                  value={editForm.date_of_initiation}
                  onChange={(e) => setEditForm({ ...editForm, date_of_initiation: e.target.value })}
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
                  <p className="text-xs text-dash-muted">Summons directory address</p>
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
                    {member.rank ?? "Not recorded"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Office</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.office_title ?? "Not an officer"}
                  </p>
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
                  <p className="text-xs text-dash-muted">Dietary requirements</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.dietary_requirements ?? "None specified"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Date of initiation</p>
                  <p className="text-sm font-medium text-dash-text">
                    {member.date_of_initiation
                      ? new Date(member.date_of_initiation).toLocaleDateString("en-GB", {
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

        {!editing && member.date_of_initiation && !member.initiation_email_sent && (
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

        <div className="rounded-2xl border border-dash-border bg-dash-surface shadow-sm">
          <div className="border-b border-dash-border px-6 py-4">
            <h3 className="text-base font-semibold text-dash-text flex items-center gap-2">
              <Wallet className="h-4 w-4 text-dash-muted" />
              Membership Dues
            </h3>
          </div>
          <div className="divide-y divide-dash-border">
            {duesRecords.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Wallet className="h-8 w-8 text-dash-faint mb-2" />
                <p className="text-sm text-dash-muted">No dues records</p>
              </div>
            ) : (
              duesRecords.map((d) => (
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
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                        DUES_VARIANTS[d.status] ?? DUES_VARIANTS.outstanding
                      )}
                    >
                      {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                    </span>
                    {d.status !== "paid" && (
                      <button
                        onClick={() =>
                          setPendingDuesAction({ duesId: d.id, action: "mark_paid" })
                        }
                        className="text-xs text-dash-muted underline hover:text-dash-text"
                      >
                        Mark paid
                      </button>
                    )}
                    {d.status === "outstanding" && (
                      <button
                        onClick={() =>
                          setPendingDuesAction({ duesId: d.id, action: "waive" })
                        }
                        className="text-xs text-dash-muted underline hover:text-dash-text"
                      >
                        Waive
                      </button>
                    )}
                    {d.status !== "outstanding" && (
                      <button
                        onClick={() =>
                          setPendingDuesAction({ duesId: d.id, action: "mark_outstanding" })
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

      {pendingDuesAction && duesActionCopy && (
        <ConfirmActionDialog
          open={Boolean(pendingDuesAction)}
          onOpenChange={(open) => {
            if (!open) setPendingDuesAction(null);
          }}
          title={duesActionCopy.title}
          description={`${duesActionCopy.description} Amount: £${(pendingDuesRecord?.amount ?? 0).toFixed(2)}.`}
          confirmLabel={duesActionCopy.confirmLabel}
          loading={duesActionLoading}
          tone={duesActionCopy.tone}
          onConfirm={() =>
            handleDuesAction(pendingDuesAction.duesId, pendingDuesAction.action)
          }
        />
      )}
    </div>
  );
}
