"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  ArrowDownUp,
  HeartHandshake,
  Repeat,
  Banknote,
  CheckCircle2,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { parseMembersCsv, type ParsedMemberRow } from "@/lib/members/csv";
import { MemberImportPreview } from "@/components/members/import-preview";
import { MemberOrderPanel } from "@/components/members/officer-order";
import { OfficesPanel, type OfficeRung } from "@/components/members/offices-panel";
import { RANK_CODES, RANK_LABELS, rankLabel } from "@/lib/members/rank";

interface MemberRow {
  id: string;
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

type DuesMethodTag =
  | "online_subscription"
  | "bacs"
  | "paid_in_full"
  | "fee_waived"
  | null;

type DuesMethodInfo = {
  method: DuesMethodTag;
  bacsMonthlyAmount: number | null;
};

export function AdminMembersClient({
  members,
  offices = [],
  giftAidDeclaredMemberIds = [],
  duesMethodByMemberId = {},
}: {
  members: MemberRow[];
  offices?: OfficeRung[];
  /** Member ids that have an active (non-revoked, confirmed) Gift Aid
   *  declaration on file in this lodge. Drives the "missing Gift Aid"
   *  and "has declaration" quick filters; computed server-side once so
   *  we avoid an N+1 against gift_aid_declarations. */
  giftAidDeclaredMemberIds?: string[];
  /** Map of member.id -> dues payment method tag for the current
   *  masonic year, including BACS monthly amount when applicable.
   *  Drives the "Dues" column on the list. Empty map = column shows
   *  "Not tagged" everywhere. */
  duesMethodByMemberId?: Record<string, DuesMethodInfo>;
}) {
  const giftAidDeclaredSet = new Set(giftAidDeclaredMemberIds);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "offices" ? "offices" : "members";
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quickFilter, setQuickFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedMemberRow[] | null>(null);
  const [showOrderPanel, setShowOrderPanel] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    address_line_1: "",
    address_line_2: "",
    city: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
    country_list: false,
    royal_arch: false,
    honorary: false,
    directory_sort_order: "",
    rank: "",
    dietary_requirements: "",
    date_of_initiation: "",
    membership_status: "active",
  });
  const [sendPortalInvite, setSendPortalInvite] = useState(false);

  const filtered = members.filter((m) => {
    const matchSearch =
      !search ||
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" || m.membership_status === statusFilter;
    let matchQuick = true;
    switch (quickFilter) {
      case "officers":
        matchQuick = Boolean(m.office_title && m.office_title.trim().length > 0);
        break;
      case "country_list":
        matchQuick = m.country_list === true;
        break;
      case "honorary":
        matchQuick = m.honorary === true;
        break;
      case "royal_arch":
        matchQuick = m.royal_arch === true;
        break;
      case "missing_address":
        matchQuick = !m.address_line_1 || m.address_line_1.trim().length === 0;
        break;
      case "missing_dietary":
        matchQuick =
          !m.dietary_requirements || m.dietary_requirements.trim().length === 0;
        break;
      case "missing_gift_aid":
        // Only chase active members: chasing a resigned/excluded Brother
        // for a Gift Aid slip would be silly, and the Charity Steward
        // wants the stack-of-slips workflow as short as possible.
        matchQuick =
          m.membership_status === "active" && !giftAidDeclaredSet.has(m.id);
        break;
      case "has_gift_aid":
        matchQuick = giftAidDeclaredSet.has(m.id);
        break;
    }
    return matchSearch && matchStatus && matchQuick;
  });

  const quickFilterCounts = {
    officers: members.filter((m) => m.office_title).length,
    country_list: members.filter((m) => m.country_list).length,
    honorary: members.filter((m) => m.honorary).length,
    royal_arch: members.filter((m) => m.royal_arch).length,
    missing_address: members.filter((m) => !m.address_line_1).length,
    missing_dietary: members.filter((m) => !m.dietary_requirements).length,
    missing_gift_aid: members.filter(
      (m) =>
        m.membership_status === "active" && !giftAidDeclaredSet.has(m.id),
    ).length,
    has_gift_aid: members.filter((m) => giftAidDeclaredSet.has(m.id)).length,
  };

  const activeCount = members.filter((m) => m.membership_status === "active").length;
  const totalCount = members.length;

  function exportMembers() {
    const headers = [
      "full_name",
      "email",
      "phone",
      "rank",
      "membership_status",
      "address_line_1",
      "address_line_2",
      "city",
      "county",
      "postcode",
      "country",
      "office_title",
      "officer_sort_order",
      "directory_sort_order",
      "royal_arch",
      "country_list",
      "honorary",
    ];
    const rows = members.map((member) =>
      headers.map((header) => {
        const value = member[header as keyof MemberRow];
        return value == null ? "" : String(value);
      })
    );
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "lodge-members.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const existingEmails = new Set(
        members.map((m) => m.email.toLowerCase())
      );
      const { rows } = parseMembersCsv(text, existingEmails);
      setPreviewRows(rows);
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone || null,
          address_line_1: formData.address_line_1 || null,
          address_line_2: formData.address_line_2 || null,
          city: formData.city || null,
          county: formData.county || null,
          postcode: formData.postcode || null,
          country: formData.country || "United Kingdom",
          directory_sort_order: formData.directory_sort_order
            ? Number(formData.directory_sort_order)
            : null,
          rank: formData.rank || null,
          dietary_requirements: formData.dietary_requirements || null,
          date_of_initiation: formData.date_of_initiation || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `Could not add member (HTTP ${res.status}).`
        );
      }
      // If the admin opted in to invite the new member to the portal we
      // chain the create with a Resend-powered invite. The invite endpoint
      // is idempotent so retrying is safe; we surface a soft error rather
      // than failing the create.
      const memberId =
        data && data.member && typeof data.member.id === "string"
          ? data.member.id
          : null;
      if (sendPortalInvite && memberId) {
        try {
          const inviteRes = await fetch(`/api/members/${memberId}/invite`, {
            method: "POST",
          });
          if (!inviteRes.ok) {
            const inviteData = await inviteRes.json().catch(() => ({}));
            throw new Error(
              (inviteData && typeof inviteData.error === "string" && inviteData.error) ||
                "Member was created but the portal invite could not be sent."
            );
          }
        } catch (inviteError) {
          setFormError(
            inviteError instanceof Error
              ? inviteError.message
              : "Member was created but the portal invite could not be sent."
          );
          // Member exists; refresh the list but keep the panel open so the
          // admin can retry from the member detail page.
          router.refresh();
          return;
        }
      }
      setShowForm(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        address_line_1: "",
        address_line_2: "",
        city: "",
        county: "",
        postcode: "",
        country: "United Kingdom",
        country_list: false,
        royal_arch: false,
        honorary: false,
        directory_sort_order: "",
        rank: "",
        dietary_requirements: "",
        date_of_initiation: "",
        membership_status: "active",
      });
      setSendPortalInvite(false);
      router.refresh();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : "Could not add member. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Members</h1>
          <p className="admin-page-copy">
            Manage lodge membership, view history and dietary requirements.
          </p>
        </div>
        <div className="admin-action-row">
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => handleImportFile(event.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="dashboard"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? "Reading..." : "Import CSV"}
          </Button>
          <Button type="button" variant="dashboard" size="sm" onClick={exportMembers}>
            Export CSV
          </Button>
          <Button
            type="button"
            variant="dashboard"
            size="sm"
            onClick={() => setShowOrderPanel(true)}
          >
            <ArrowDownUp className="mr-1.5 h-4 w-4" />
            Order directory
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormError(null);
              setShowForm(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Member
          </Button>
        </div>
      </div>

      <Tabs defaultValue={initialTab} className="space-y-4 sm:space-y-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="offices">
            Offices
            <Badge
              variant="outline"
              className="ml-2 h-4 min-w-4 justify-center border-transparent bg-white/20 px-1 text-[10px] tabular-nums"
            >
              {offices.filter((o) => o.current_member_id).length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-5 sm:space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <Card variant="kpi" className="dash-kpi-card rounded-xl p-3 sm:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted sm:text-xs">
                Total members
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-dash-text sm:mt-2 sm:text-3xl">
                {totalCount}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 sm:h-11 sm:w-11">
              <Users className="h-4 w-4 text-blue-600 sm:h-5 sm:w-5" />
            </div>
          </div>
        </Card>
        <Card variant="kpi" className="dash-kpi-card rounded-xl p-3 sm:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted sm:text-xs">
                Active members
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-dash-text sm:mt-2 sm:text-3xl">
                {activeCount}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 sm:h-11 sm:w-11">
              <Shield className="h-4 w-4 text-emerald-600 sm:h-5 sm:w-5" />
            </div>
          </div>
        </Card>
        <Card variant="kpi" className="dash-kpi-card col-span-2 rounded-xl p-3 sm:col-span-1 sm:p-5">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-dash-muted sm:text-xs">
                With dietary reqs
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-dash-text sm:mt-2 sm:text-3xl">
                {members.filter((m) => m.dietary_requirements).length}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 sm:h-11 sm:w-11">
              <UtensilsCrossed className="h-4 w-4 text-amber-700 sm:h-5 sm:w-5" />
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
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
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all", label: "All members", count: members.length },
              { id: "officers", label: "Officers", count: quickFilterCounts.officers },
              { id: "country_list", label: "Country List", count: quickFilterCounts.country_list },
              { id: "honorary", label: "Honorary", count: quickFilterCounts.honorary },
              { id: "royal_arch", label: "Royal Arch", count: quickFilterCounts.royal_arch },
              { id: "missing_address", label: "Missing address", count: quickFilterCounts.missing_address },
              { id: "missing_dietary", label: "Missing dietary", count: quickFilterCounts.missing_dietary },
              {
                id: "missing_gift_aid",
                label: "Missing Gift Aid",
                count: quickFilterCounts.missing_gift_aid,
              },
              {
                id: "has_gift_aid",
                label: "Gift Aid on file",
                count: quickFilterCounts.has_gift_aid,
              },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              onClick={() => setQuickFilter(f.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                quickFilter === f.id
                  ? "border-blue-500/40 bg-blue-50 text-blue-900"
                  : "border-dash-border bg-dash-surface-subtle text-dash-muted hover:border-dash-border-strong hover:text-dash-text"
              )}
            >
              {f.label}
              <Badge
                variant="outline"
                className={cn(
                  "h-4 min-w-4 justify-center border-transparent bg-white/60 px-1 text-[10px] tabular-nums",
                  quickFilter === f.id
                    ? "text-blue-900"
                    : "text-dash-muted"
                )}
              >
                {f.count}
              </Badge>
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
                <th className="px-4 py-3 hidden md:table-cell">Dues</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-dash-muted">
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
                      <span className="inline-flex items-center gap-2">
                        {m.full_name}
                        {m.membership_status === "active" &&
                        !giftAidDeclaredSet.has(m.id) ? (
                          <span
                            title="No Gift Aid declaration on file. Open the profile to upload a paper slip."
                            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                          >
                            <HeartHandshake className="h-2.5 w-2.5" />
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted">{m.email}</td>
                    <td className="px-4 py-3.5 text-dash-muted hidden md:table-cell">
                      {rankLabel(m.rank) ?? "Not recorded"}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden lg:table-cell">
                      {m.date_of_initiation
                        ? new Date(m.date_of_initiation).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Not recorded"}
                    </td>
                    <td className="px-4 py-3.5 text-dash-muted hidden lg:table-cell">
                      {m.dietary_requirements ?? "Not recorded"}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <DuesMethodPill
                        info={duesMethodByMemberId[m.id] ?? null}
                      />
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
        </TabsContent>

        <TabsContent value="offices">
          <OfficesPanel
            offices={offices}
            members={members
              .filter((m) => m.membership_status === "active")
              .map((m) => ({
                id: m.id,
                full_name: m.full_name,
                rank: m.rank,
              }))}
          />
        </TabsContent>
      </Tabs>

      {previewRows && (
        <MemberImportPreview
          rows={previewRows}
          onClose={() => setPreviewRows(null)}
          onComplete={() => {
            setPreviewRows(null);
            router.refresh();
          }}
        />
      )}

      {showOrderPanel && (
        <MemberOrderPanel
          members={members.map((m) => ({
            id: m.id,
            full_name: m.full_name,
            office_title: m.office_title,
            officer_sort_order: m.officer_sort_order,
            directory_sort_order: m.directory_sort_order,
          }))}
          onClose={() => setShowOrderPanel(false)}
        />
      )}

      {showForm && (
        <div className="admin-drawer-shell fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-dash-text/20 backdrop-blur-[2px]"
            onClick={() => {
              setShowForm(false);
              setFormError(null);
            }}
          />
          <div className="admin-drawer-panel relative w-full max-w-md bg-dash-surface shadow-xl border-l border-dash-border overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-dash-border bg-dash-surface px-6 py-4">
              <h2 className="text-lg font-semibold text-dash-text flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Add Member
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="rounded-lg p-1.5 text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              {formError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {formError}
                </div>
              )}
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
              <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
                <p className="text-sm font-semibold text-dash-text">
                  Summons directory address
                </p>
                <div className="space-y-2">
                  <Label htmlFor="address_line_1">Address line 1</Label>
                  <Input
                    id="address_line_1"
                    value={formData.address_line_1}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line_1: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_line_2">Address line 2</Label>
                  <Input
                    id="address_line_2"
                    value={formData.address_line_2}
                    onChange={(e) =>
                      setFormData({ ...formData, address_line_2: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      value={formData.county}
                      onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={formData.postcode}
                      onChange={(e) =>
                        setFormData({ ...formData, postcode: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={formData.country}
                      onChange={(e) =>
                        setFormData({ ...formData, country: e.target.value })
                      }
                    />
                  </div>
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
                    {RANK_CODES.map((code) => (
                      <option key={code} value={code}>
                        {RANK_LABELS[code]}
                      </option>
                    ))}
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
              <div className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
                <p className="text-sm font-semibold text-dash-text">
                  Directory settings
                </p>
                <p className="text-xs text-dash-muted">
                  Assign an office after creating the member — open the
                  Offices tab on the Members page.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="directory_sort_order">Directory order</Label>
                  <Input
                    id="directory_sort_order"
                    type="number"
                    min="0"
                    value={formData.directory_sort_order}
                    onChange={(e) =>
                      setFormData({ ...formData, directory_sort_order: e.target.value })
                    }
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={formData.royal_arch}
                    onChange={(e) =>
                      setFormData({ ...formData, royal_arch: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Royal Arch member
                </label>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={formData.country_list}
                    onChange={(e) =>
                      setFormData({ ...formData, country_list: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Country List member
                </label>
                <label className="flex items-center gap-2 text-sm text-dash-muted">
                  <input
                    type="checkbox"
                    checked={formData.honorary}
                    onChange={(e) =>
                      setFormData({ ...formData, honorary: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-dash-border"
                  />
                  Honorary member
                </label>
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
              <label className="flex items-start gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-sm text-dash-muted">
                <input
                  type="checkbox"
                  checked={sendPortalInvite}
                  onChange={(e) => setSendPortalInvite(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-dash-border"
                />
                <span>
                  <span className="block font-semibold text-dash-text">
                    Send member portal invite immediately
                  </span>
                  We&apos;ll email them a Resend-powered invite to set their
                  password and access the member portal.
                </span>
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="submit" variant="primary" className="flex-1" disabled={saving}>
                  {saving
                    ? "Saving..."
                    : sendPortalInvite
                      ? "Add member & send invite"
                      : "Add Member"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setFormError(null);
                  }}
                >
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

// ---------------------------------------------------------------------------
// DuesMethodPill
// ---------------------------------------------------------------------------
// Inline column pill showing how a member is paying this year's
// dues. Mirrors the badges on the dues-method panel so admins see the
// same vocabulary across screens. The "Not tagged" state is styled
// with an amber outline so it nudges the treasurer without being
// alarmist — every untagged member is a follow-up they should make.

function DuesMethodPill({ info }: { info: DuesMethodInfo | null }) {
  const method = info?.method ?? null;

  if (method === "online_subscription") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
        <Repeat className="h-3 w-3" />
        Online
      </span>
    );
  }
  if (method === "bacs") {
    const amt =
      info?.bacsMonthlyAmount != null
        ? ` £${info.bacsMonthlyAmount.toFixed(2)}/mo`
        : "";
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
        <Banknote className="h-3 w-3" />
        BACS
        {amt}
      </span>
    );
  }
  if (method === "paid_in_full") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        Paid in full
      </span>
    );
  }
  if (method === "fee_waived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
        <Wallet className="h-3 w-3" />
        Waived
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-white px-2 py-0.5 text-xs font-medium text-amber-700">
      <AlertCircle className="h-3 w-3" />
      Not tagged
    </span>
  );
}
