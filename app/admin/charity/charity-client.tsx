"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  Target,
  TrendingUp,
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  Pause,
  Gift,
  ArrowRight,
  Download,
  Users,
  Coins,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  raised_amount: number;
  status: "active" | "completed" | "paused";
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

type Donation = {
  id: string;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  source: string;
  event_id?: string | null;
  campaign_id?: string | null;
  gift_aid_declared?: boolean;
  status: string;
  created_at: string;
};

type GiftAidDeclaration = {
  id: string;
  donor_name: string;
  donor_email: string;
  declaration_date?: string;
  reclaimable_amount?: number;
  status: string;
};

type MeetingCollection = {
  id: string;
  title: string;
  collection_date: string;
  cash_amount: number;
  card_amount: number;
  anonymous_cash_amount: number;
  gasds_eligible_amount: number;
  gasds_tax_year: string | null;
};

type GasdsClaim = {
  id: string;
  tax_year: string;
  eligible_cash_amount: number;
  claimed_cash_amount: number;
  reclaimable_amount: number;
  status: "draft" | "exported" | "filed" | "paid";
};

type KpiAccent = "emerald" | "blue" | "violet" | "amber";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  violet: { wrap: "bg-violet-500/10", icon: "text-violet-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

function campaignStatusBadge(status: string) {
  if (status === "active")
    return (
      <Badge variant="secondary" className="gap-1 border-blue-200 bg-blue-50 capitalize text-blue-800">
        <Clock className="h-3.5 w-3.5" />
        {status}
      </Badge>
    );
  if (status === "completed")
    return (
      <Badge variant="success" className="gap-1 border-emerald-200 capitalize">
        <CheckCircle2 className="h-3.5 w-3.5" />
        {status}
      </Badge>
    );
  return (
    <Badge variant="warning" className="gap-1 border-amber-200 capitalize">
      <Pause className="h-3.5 w-3.5" />
      {status}
    </Badge>
  );
}

export function AdminCharityClient({
  campaigns,
  donations,
  giftAidDeclarations,
  meetingCollections,
  gasdsClaims,
  currentCharityCampaignId,
  lodgeSlug,
}: {
  campaigns: Campaign[];
  donations: Donation[];
  giftAidDeclarations: GiftAidDeclaration[];
  meetingCollections: MeetingCollection[];
  gasdsClaims: GasdsClaim[];
  currentCharityCampaignId?: string | null;
  lodgeSlug?: string;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [description, setDescription] = useState("");
  const [endDate, setEndDate] = useState("");
  const [collectionTitle, setCollectionTitle] = useState("Festive board collection");
  const [collectionCash, setCollectionCash] = useState("");
  const [collectionCard, setCollectionCard] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [savingGasds, setSavingGasds] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const totalRaised = campaigns.reduce((s, c) => s + c.raised_amount, 0);
  const totalTarget = activeCampaigns.reduce((s, c) => s + c.target_amount, 0);
  const totalDonations = donations.reduce((s, d) => s + d.amount, 0);
  const totalGiftAid = giftAidDeclarations
    .filter((g) => g.status === "active")
    .reduce((s, g) => s + (g.reclaimable_amount ?? 0), 0);
  const meetingLinkedDonations = donations.filter((d) => Boolean(d.event_id));
  const gasdsEligible = meetingCollections.reduce(
    (sum, collection) => sum + collection.gasds_eligible_amount,
    0
  );
  const donorRows = [...donations.reduce((map, donation) => {
    const key = donation.donor_email.toLowerCase();
    const current = map.get(key) ?? {
      email: donation.donor_email,
      name: donation.donor_name ?? "Anonymous",
      total: 0,
      count: 0,
      giftAidCount: 0,
    };
    current.total += donation.amount;
    current.count += 1;
    if (donation.gift_aid_declared) current.giftAidCount += 1;
    map.set(key, current);
    return map;
  }, new Map<string, { email: string; name: string; total: number; count: number; giftAidCount: number }>()).values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    icon: LucideIcon;
    accent: KpiAccent;
    valueClass?: string;
  }> = [
    {
      label: "Total raised",
      value: `£${totalRaised.toLocaleString()}`,
      hint: "Across all campaigns",
      icon: TrendingUp,
      accent: "emerald",
    },
    {
      label: "Active target",
      value: `£${totalTarget.toLocaleString()}`,
      hint: `${activeCampaigns.length} active campaign${activeCampaigns.length !== 1 ? "s" : ""}`,
      icon: Target,
      accent: "blue",
    },
    {
      label: "Total donations",
      value: `£${totalDonations.toLocaleString()}`,
      hint: `${donations.length} donations`,
      icon: Gift,
      accent: "violet",
    },
    {
      label: "Gift Aid reclaimable",
      value: `£${totalGiftAid.toFixed(2)}`,
      hint: `${giftAidDeclarations.filter((g) => g.status === "active").length} active declarations`,
      icon: Shield,
      accent: "amber",
      valueClass: "text-emerald-700",
    },
  ];

  async function handleCreateCampaign(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/charity-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: campaignName,
          target_amount: Number(targetAmount),
          description,
          end_date: endDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create campaign");
      }
      setCampaignName("");
      setTargetAmount("");
      setDescription("");
      setEndDate("");
      setShowForm(false);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not create campaign."
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordMeetingCollection(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCollectionError(null);
    setSavingCollection(true);
    try {
      const res = await fetch("/api/meeting-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: collectionTitle,
          cash_amount: Number(collectionCash || 0),
          anonymous_cash_amount: Number(collectionCash || 0),
          card_amount: Number(collectionCard || 0),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not record collection.");
      setCollectionTitle("Festive board collection");
      setCollectionCash("");
      setCollectionCard("");
      router.refresh();
    } catch (error) {
      setCollectionError(
        error instanceof Error ? error.message : "Could not record collection."
      );
    } finally {
      setSavingCollection(false);
    }
  }

  async function createGasdsClaim() {
    setSavingGasds("create");
    setCollectionError(null);
    try {
      const res = await fetch("/api/gasds/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create GASDS claim.");
      router.refresh();
    } catch (error) {
      setCollectionError(
        error instanceof Error ? error.message : "Could not create GASDS claim."
      );
    } finally {
      setSavingGasds(null);
    }
  }

  async function updateGasdsClaimStatus(claimId: string, status: "exported" | "filed" | "paid") {
    setSavingGasds(claimId);
    setCollectionError(null);
    try {
      const res = await fetch(`/api/gasds/claims/${claimId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not update GASDS claim.");
      router.refresh();
    } catch (error) {
      setCollectionError(
        error instanceof Error ? error.message : "Could not update GASDS claim."
      );
    } finally {
      setSavingGasds(null);
    }
  }

  function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
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

  function exportDonorRecords() {
    downloadCsv(
      "charity-donor-records.csv",
      ["Name", "Email", "Total donated", "Donation count", "Gift Aid donations"],
      donorRows.map((donor) => [
        donor.name,
        donor.email,
        donor.total,
        donor.count,
        donor.giftAidCount,
      ])
    );
  }

  function exportCampaignTotals() {
    downloadCsv(
      "charity-campaign-totals.csv",
      ["Campaign", "Status", "Target", "Raised", "Donation count", "Start date", "End date"],
      campaigns.map((campaign) => {
        const campaignDonations = donations.filter((d) => d.campaign_id === campaign.id);
        return [
          campaign.name,
          campaign.status,
          campaign.target_amount,
          campaign.raised_amount,
          campaignDonations.length,
          campaign.start_date,
          campaign.end_date,
        ];
      })
    );
  }

  function exportMeetingCollections() {
    downloadCsv(
      "meeting-linked-charity-collections.csv",
      ["Date", "Donor", "Email", "Amount", "Source", "Event ID", "Gift Aid"],
      meetingLinkedDonations.map((donation) => [
        donation.created_at,
        donation.donor_name,
        donation.donor_email,
        donation.amount,
        donation.source,
        donation.event_id ?? "",
        donation.gift_aid_declared ? "yes" : "no",
      ])
    );
  }

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div className="flex-1">
          <h1 className="admin-page-title">Charity</h1>
          <p className="admin-page-copy">
            Manage charity campaigns, track donations, and oversee Gift Aid.
          </p>
        </div>
        <Button variant="primary" className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          return (
            <Card
              key={k.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                    {k.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-3xl font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text",
                      k.valueClass
                    )}
                  >
                    {k.value}
                  </p>
                  <p className="mt-2 text-xs text-dash-muted">{k.hint}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    ac.wrap
                  )}
                >
                  <Icon className={cn("h-5 w-5", ac.icon)} aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
          Quick links
        </span>
        <Button variant="dashboard" size="sm" asChild>
          <Link href="/admin/donations">Donations</Link>
        </Button>
        <Button variant="dashboard" size="sm" asChild>
          <Link href="/admin/payments">Payments &amp; Gift Aid</Link>
        </Button>
      </div>

      <Card variant="panel" className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-base font-semibold text-dash-text">Charity Reporting</h2>
            <p className="mt-1 text-sm text-dash-muted">
              Donor records, campaign totals, Gift Aid readiness, and meeting-linked charity collections.
            </p>
            <p className="mt-2 text-xs text-dash-faint">
              {donorRows.length} donors · {meetingLinkedDonations.length} meeting collections · £{totalGiftAid.toFixed(2)} Gift Aid reclaimable
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="dashboard" size="sm" onClick={exportDonorRecords}>
              <Users className="mr-1.5 h-4 w-4" />
              Donor Records
            </Button>
            <Button type="button" variant="dashboard" size="sm" onClick={exportCampaignTotals}>
              <Download className="mr-1.5 h-4 w-4" />
              Campaign Totals
            </Button>
            <Button type="button" variant="dashboard" size="sm" onClick={exportMeetingCollections}>
              <Download className="mr-1.5 h-4 w-4" />
              Meeting Collections
            </Button>
          </div>
        </div>
        {donorRows.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {donorRows.slice(0, 3).map((donor) => (
              <div
                key={donor.email}
                className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4"
              >
                <p className="text-sm font-semibold text-dash-text">{donor.name}</p>
                <p className="mt-1 truncate text-xs text-dash-muted">{donor.email}</p>
                <p className="mt-3 text-lg font-semibold text-dash-text">
                  £{donor.total.toFixed(2)}
                </p>
                <p className="text-xs text-dash-muted">
                  {donor.count} donation{donor.count === 1 ? "" : "s"}, {donor.giftAidCount} Gift Aid
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card variant="panel" className="p-5">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-700" />
              <h2 className="text-base font-semibold text-dash-text">
                Festive board and GASDS collections
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-dash-muted">
              Record small cash collections at the point they happen. LodgePay tracks the annual GASDS allowance separately from Gift Aid declarations.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-dash-muted">
                  GASDS eligible
                </p>
                <p className="mt-2 text-2xl font-semibold text-dash-text">
                  £{gasdsEligible.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-dash-muted">£8,000 annual cap tracked in the API</p>
              </div>
              <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-dash-muted">
                  Reclaimable equivalent
                </p>
                <p className="mt-2 text-2xl font-semibold text-emerald-700">
                  £{(Math.min(gasdsEligible, 8000) * 0.25).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-dash-muted">Reported separately from donor Gift Aid</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-dash-text">GASDS claim workflow</p>
                  <p className="mt-1 text-xs text-dash-muted">
                    Create a draft claim from tracked small cash collections, then mark it exported, filed, and paid.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="dashboard"
                  size="sm"
                  onClick={createGasdsClaim}
                  disabled={savingGasds === "create" || meetingCollections.length === 0}
                >
                  {savingGasds === "create" ? "Creating..." : "Create draft claim"}
                </Button>
              </div>
              {gasdsClaims.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {gasdsClaims.slice(0, 3).map((claim) => (
                    <li key={claim.id} className="rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-dash-text">
                          {claim.tax_year}: £{claim.reclaimable_amount.toFixed(2)} reclaimable
                        </span>
                        <Badge variant={claim.status === "paid" ? "success" : "outline"}>
                          {claim.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {claim.status === "draft" ? (
                          <Button
                            type="button"
                            variant="dashboard"
                            size="sm"
                            onClick={() => updateGasdsClaimStatus(claim.id, "exported")}
                            disabled={savingGasds === claim.id}
                          >
                            Mark exported
                          </Button>
                        ) : null}
                        {claim.status === "exported" ? (
                          <Button
                            type="button"
                            variant="dashboard"
                            size="sm"
                            onClick={() => updateGasdsClaimStatus(claim.id, "filed")}
                            disabled={savingGasds === claim.id}
                          >
                            Mark filed
                          </Button>
                        ) : null}
                        {claim.status === "filed" ? (
                          <Button
                            type="button"
                            variant="dashboard"
                            size="sm"
                            onClick={() => updateGasdsClaimStatus(claim.id, "paid")}
                            disabled={savingGasds === claim.id}
                          >
                            Mark paid
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <form onSubmit={recordMeetingCollection} className="space-y-3">
            {collectionError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {collectionError}
              </div>
            ) : null}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                Collection title
              </label>
              <input
                type="text"
                value={collectionTitle}
                onChange={(event) => setCollectionTitle(event.target.value)}
                className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Anonymous cash (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectionCash}
                  onChange={(event) => setCollectionCash(event.target.value)}
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Card or linked donations (£)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={collectionCard}
                  onChange={(event) => setCollectionCard(event.target.value)}
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text"
                />
              </div>
            </div>
            <Button type="submit" variant="primary" disabled={savingCollection}>
              {savingCollection ? "Recording..." : "Record collection"}
            </Button>
          </form>
        </div>
      </Card>

      {showForm && (
        <Card variant="panel" className="overflow-hidden border-dash-ring/30 bg-dash-surface-subtle p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <h2 className="dash-panel-header-title">New charity campaign</h2>
            <p className="dash-panel-header-description">
              Create a target-led campaign for this lodge.
            </p>
          </div>
          <form
            onSubmit={handleCreateCampaign}
            className="space-y-4 border-t border-dash-border p-5 md:p-6"
          >
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {formError}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Campaign name
                </label>
                <input
                  type="text"
                  placeholder="e.g. MCF Festival 2026"
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  required
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Target amount (£)
                </label>
                <input
                  type="number"
                  placeholder="5000"
                  min={0}
                  step="0.01"
                  value={targetAmount}
                  onChange={(event) => setTargetAmount(event.target.value)}
                  required
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the campaign purpose..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full resize-none rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  End date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Creating..." : "Create Campaign"}
              </Button>
              <Button type="button" variant="dashboard" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <CurrentCampaignPanel
        campaigns={campaigns}
        currentCharityCampaignId={currentCharityCampaignId ?? null}
        lodgeSlug={lodgeSlug ?? "default"}
        onSaved={() => router.refresh()}
      />

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Campaigns</h2>
            <p className="dash-panel-header-description">
              Progress toward targets and linked donation counts.
            </p>
          </div>
        </div>
        <div className="space-y-4 border-t border-dash-border bg-dash-surface p-4 md:p-5">
          {campaigns.map((campaign) => {
            const pct = Math.min(
              100,
              Math.round((campaign.raised_amount / campaign.target_amount) * 100)
            );
            const campaignDonations = donations.filter((d) => d.campaign_id === campaign.id);
            return (
              <Link
                key={campaign.id}
                href={`/admin/charity/${campaign.id}`}
                className="block rounded-xl border border-dash-border bg-dash-surface-subtle/50 p-5 shadow-sm transition-colors hover:border-dash-border-strong hover:bg-dash-surface"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="truncate text-base font-semibold text-dash-text">
                        {campaign.name}
                      </h3>
                      {campaignStatusBadge(campaign.status)}
                    </div>
                    {campaign.description && (
                      <p className="mt-1 text-sm text-dash-text-muted">{campaign.description}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-2xl font-bold tabular-nums text-dash-text">
                      £{campaign.raised_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-dash-text-muted">
                      of £{campaign.target_amount.toLocaleString()} target
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs text-dash-text-muted">{pct}% complete</span>
                    <span className="text-xs text-dash-text-faint">
                      £{(campaign.target_amount - campaign.raised_amount).toLocaleString()} remaining
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-dash-border">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        pct >= 100
                          ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                          : "bg-gradient-to-r from-dash-ring to-blue-400"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-dash-text-muted">
                  <span>Started {formatDate(campaign.start_date)}</span>
                  {campaign.end_date && <span>Ends {formatDate(campaign.end_date)}</span>}
                  <span>{campaignDonations.length} donations</span>
                  <span className="ml-auto inline-flex items-center gap-1 text-dash-ring">
                    Open <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </Link>
            );
          })}
          {campaigns.length === 0 && (
            <p className="py-8 text-center text-sm text-dash-text-muted">No campaigns yet.</p>
          )}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header flex-col gap-3 rounded-none border-dash-border bg-dash-surface-subtle sm:flex-row sm:items-center">
            <div>
              <h2 className="dash-panel-header-title">Recent donations</h2>
              <p className="dash-panel-header-description">Latest five across all sources.</p>
            </div>
            <Button variant="dashboard" size="sm" asChild className="shrink-0">
              <Link href="/admin/donations" className="gap-1">
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <div className="space-y-2 border-t border-dash-border bg-dash-surface p-4 md:p-5">
            {donations.length === 0 ? (
              <p className="text-sm text-dash-text-muted">No donations yet.</p>
            ) : (
              donations.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-surface-subtle/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-dash-text">{d.donor_name}</p>
                    <p className="text-xs text-dash-text-muted">{d.source} donation</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums text-dash-text">
                      £{d.amount.toFixed(2)}
                    </p>
                    {d.gift_aid_declared && (
                      <Badge variant="success" className="mt-1 text-[10px]">
                        +Gift Aid
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Gift Aid summary</h2>
              <p className="dash-panel-header-description">Reclaimable totals by donor.</p>
            </div>
          </div>
          <div className="border-t border-dash-border bg-dash-surface p-4 md:p-5">
            <div className="mb-4 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-500/[0.08] to-blue-500/[0.06] p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-xs text-dash-text-muted">Total reclaimable</p>
                  <p className="text-2xl font-bold text-emerald-700">£{totalGiftAid.toFixed(2)}</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {giftAidDeclarations.slice(0, 4).map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between rounded-lg border border-dash-border bg-dash-surface-subtle/50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-dash-text">{g.donor_name}</p>
                    <p className="text-xs text-dash-text-muted">
                      Declared {g.declaration_date ? formatDate(g.declaration_date) : "Not recorded"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-emerald-700">
                      £{(g.reclaimable_amount ?? 0).toFixed(2)}
                    </p>
                    <Badge
                      variant={
                        g.status === "active"
                          ? "success"
                          : g.status === "expired"
                            ? "warning"
                            : "destructive"
                      }
                      className="mt-1 text-[10px] capitalize"
                    >
                      {g.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function CurrentCampaignPanel({
  campaigns,
  currentCharityCampaignId,
  lodgeSlug,
  onSaved,
}: {
  campaigns: Campaign[];
  currentCharityCampaignId: string | null;
  lodgeSlug: string;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string>(
    currentCharityCampaignId ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const current = campaigns.find((c) => c.id === currentCharityCampaignId);
  const dirty = (selected || null) !== (currentCharityCampaignId ?? null);
  const giveUrl = `/give/${lodgeSlug}/charity`;

  const save = async (campaignId: string | null) => {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await fetch("/api/lodges/current-charity-campaign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not save designation.");
        return;
      }
      setFeedback(
        campaignId
          ? "Designated as the lodge's current charity campaign."
          : "Cleared the designated campaign.",
      );
      onSaved();
    } catch (err) {
      console.error("save current campaign failed", err);
      setError("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div>
          <h2 className="dash-panel-header-title">
            Standing donation link &amp; QR
          </h2>
          <p className="dash-panel-header-description">
            Pick the campaign that the standing-QR sticker and
            <code className="mx-1 rounded bg-dash-surface px-1 text-xs">/give/{lodgeSlug}/charity</code>
            link route to. Change it once a year when the lodge picks a new
            featured cause.
          </p>
        </div>
      </div>
      <div className="space-y-4 border-t border-dash-border bg-dash-surface p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
          <div className="space-y-3">
            <label className="text-sm font-medium text-dash-text">
              Current featured campaign
            </label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={saving}
              className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
            >
              <option value="">— No designated campaign —</option>
              {activeCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                  {currentCharityCampaignId === campaign.id ? " (current)" : ""}
                </option>
              ))}
              {/* If the current one is paused/completed, keep it selectable so
                  the steward sees what's still set + can clear it. */}
              {currentCharityCampaignId &&
              current &&
              current.status !== "active" ? (
                <option value={current.id}>
                  {current.name} ({current.status} — please update)
                </option>
              ) : null}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!dirty || saving}
                onClick={() => save(selected || null)}
              >
                {saving ? "Saving…" : dirty ? "Save designation" : "Saved"}
              </Button>
              {currentCharityCampaignId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="dashboard"
                  disabled={saving}
                  onClick={() => {
                    setSelected("");
                    void save(null);
                  }}
                >
                  Clear designation
                </Button>
              ) : null}
            </div>
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : feedback ? (
              <p className="text-sm text-emerald-700">{feedback}</p>
            ) : null}
          </div>
          <div className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-4 text-sm">
            <p className="font-medium text-dash-text">Sticker link</p>
            <p className="mt-1 break-all font-mono text-xs text-dash-text-muted">
              {giveUrl}
            </p>
            <p className="mt-2 text-dash-text-muted">
              Any device that scans this link is sent to a Mooov-branded page
              to pay. {current
                ? `Currently goes to "${current.name}".`
                : "Set a campaign above to start collecting via the standing QR."}
            </p>
            <div className="mt-3">
              <Button asChild variant="dashboard" size="sm">
                <Link href={giveUrl} target="_blank" rel="noopener noreferrer">
                  Preview link
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
