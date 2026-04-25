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
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
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

  const [editForm, setEditForm] = useState({
    full_name: member.full_name,
    phone: member.phone ?? "",
    rank: member.rank ?? "",
    dietary_requirements: member.dietary_requirements ?? "",
    date_of_initiation: member.date_of_initiation ?? "",
    membership_status: member.membership_status,
  });

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editForm.full_name,
          phone: editForm.phone || null,
          rank: editForm.rank || null,
          dietary_requirements: editForm.dietary_requirements || null,
          date_of_initiation: editForm.date_of_initiation || null,
          membership_status: editForm.membership_status,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMember(data.member);
        setEditing(false);
        router.refresh();
      }
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  }

  async function handleResendInitiation() {
    try {
      await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiation_email_sent: false }),
      });
      router.refresh();
    } catch {
      /* empty */
    }
  }

  async function handleWaiveDues(duesId: string) {
    try {
      await fetch("/api/dues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "waive", dues_id: duesId }),
      });
      setDuesRecords((prev) =>
        prev.map((d) => (d.id === duesId ? { ...d, status: "waived" } : d))
      );
    } catch {
      /* empty */
    }
  }

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
            {!editing ? (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
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
                  <p className="text-sm font-medium text-dash-text">{member.phone ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Award className="h-4 w-4 mt-0.5 text-dash-muted shrink-0" />
                <div>
                  <p className="text-xs text-dash-muted">Rank</p>
                  <p className="text-sm font-medium text-dash-text">{member.rank ?? "—"}</p>
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
                    {d.status === "outstanding" && (
                      <button
                        onClick={() => handleWaiveDues(d.id)}
                        className="text-xs text-dash-muted hover:text-dash-text underline"
                      >
                        Waive
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
    </div>
  );
}
