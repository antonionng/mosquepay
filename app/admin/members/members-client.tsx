"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Search,
  Plus,
  X,
  UserPlus,
  Mail,
  Phone,
  Calendar,
  Shield,
  ChevronRight,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MemberRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  rank: string | null;
  dietary_requirements: string | null;
  date_of_initiation: string | null;
  membership_status: string;
  created_at: string;
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

export function AdminMembersClient({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    rank: "",
    dietary_requirements: "",
    date_of_initiation: "",
    membership_status: "active",
  });

  const filtered = members.filter((m) => {
    const matchSearch =
      !search ||
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" || m.membership_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const activeCount = members.filter((m) => m.membership_status === "active").length;
  const totalCount = members.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone || null,
          rank: formData.rank || null,
          dietary_requirements: formData.dietary_requirements || null,
          date_of_initiation: formData.date_of_initiation || null,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({
          full_name: "",
          email: "",
          phone: "",
          rank: "",
          dietary_requirements: "",
          date_of_initiation: "",
          membership_status: "active",
        });
        router.refresh();
      }
    } catch {
      /* handle error */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Members</h1>
          <p className="admin-page-copy">
            Manage lodge membership, view history and dietary requirements.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card variant="kpi" className="dash-kpi-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted">
                Total Members
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text">
                {totalCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </Card>
        <Card variant="kpi" className="dash-kpi-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted">
                Active Members
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text">
                {activeCount}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>
        <Card variant="kpi" className="dash-kpi-card rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted">
                With Dietary Reqs
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text">
                {members.filter((m) => m.dietary_requirements).length}
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10">
              <UtensilsCrossed className="h-5 w-5 text-amber-700" />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {["all", "active", "suspended", "resigned", "excluded"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-dash-surface-subtle text-dash-text shadow-sm ring-1 ring-dash-border"
                  : "text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text"
              )}
            >
              {s === "all" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs font-medium uppercase tracking-wider text-dash-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 hidden md:table-cell">Rank</th>
                <th className="px-4 py-3 hidden lg:table-cell">Initiation</th>
                <th className="px-4 py-3 hidden lg:table-cell">Dietary</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-dash-muted">
                    <Users className="mx-auto h-8 w-8 text-dash-faint mb-2" />
                    No members found
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    className="group cursor-pointer transition-colors hover:bg-dash-surface-subtle"
                    onClick={() => router.push(`/admin/members/${m.id}`)}
                  >
                    <td className="px-4 py-3.5 font-medium text-dash-text">
                      {m.full_name}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted">{m.email}</td>
                    <td className="px-4 py-3.5 text-dash-muted hidden md:table-cell">
                      {m.rank ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden lg:table-cell">
                      {m.date_of_initiation
                        ? new Date(m.date_of_initiation).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden lg:table-cell">
                      {m.dietary_requirements ?? "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
                          STATUS_VARIANTS[m.membership_status] ?? STATUS_VARIANTS.active
                        )}
                      >
                        {STATUS_LABELS[m.membership_status] ?? m.membership_status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <ChevronRight className="h-4 w-4 text-dash-faint group-hover:text-dash-muted transition-colors" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-dash-text/20 backdrop-blur-[2px]"
            onClick={() => setShowForm(false)}
          />
          <div className="relative w-full max-w-md bg-dash-surface shadow-xl border-l border-dash-border overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dash-border bg-dash-surface px-6 py-4">
              <h2 className="text-lg font-semibold text-dash-text flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Member
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1.5 text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input
                  id="full_name"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                  <Input
                    id="email"
                    type="email"
                    required
                    className="pl-9"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                  <Input
                    id="phone"
                    type="tel"
                    className="pl-9"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rank">Rank</Label>
                  <select
                    id="rank"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="EA">Entered Apprentice</option>
                    <option value="FC">Fellow Craft</option>
                    <option value="MM">Master Mason</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm"
                    value={formData.membership_status}
                    onChange={(e) => setFormData({ ...formData, membership_status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dietary">Dietary requirements</Label>
                <Input
                  id="dietary"
                  placeholder="e.g. Vegetarian, Gluten-free"
                  value={formData.dietary_requirements}
                  onChange={(e) => setFormData({ ...formData, dietary_requirements: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initiation_date">Date of initiation</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-muted" />
                  <Input
                    id="initiation_date"
                    type="date"
                    className="pl-9"
                    value={formData.date_of_initiation}
                    onChange={(e) => setFormData({ ...formData, date_of_initiation: e.target.value })}
                  />
                </div>
                <p className="text-xs text-dash-muted">
                  On this date the member will receive an email with a payment link for membership fees.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Add Member"}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
