"use client";

import { useState } from "react";
import Link from "next/link";
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
}: {
  campaigns: Campaign[];
  donations: Donation[];
  giftAidDeclarations: GiftAidDeclaration[];
}) {
  const [showForm, setShowForm] = useState(false);

  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const totalRaised = campaigns.reduce((s, c) => s + c.raised_amount, 0);
  const totalTarget = activeCampaigns.reduce((s, c) => s + c.target_amount, 0);
  const totalDonations = donations.reduce((s, d) => s + d.amount, 0);
  const totalGiftAid = giftAidDeclarations
    .filter((g) => g.status === "active")
    .reduce((s, g) => s + (g.reclaimable_amount ?? 0), 0);

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

  return (
    <div className="space-y-8">
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

      {showForm && (
        <Card variant="panel" className="overflow-hidden border-dash-ring/30 bg-dash-surface-subtle p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <h2 className="dash-panel-header-title">New charity campaign</h2>
            <p className="dash-panel-header-description">
              Draft details — wire to your backend when ready.
            </p>
          </div>
          <div className="space-y-4 border-t border-dash-border p-5 md:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Campaign name
                </label>
                <input
                  type="text"
                  placeholder="e.g. MCF Festival 2026"
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
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the campaign purpose…"
                  className="w-full resize-none rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text placeholder:text-dash-faint focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-dash-text-muted">
                  End date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2.5 text-sm text-dash-text focus:border-dash-ring focus:outline-none focus:ring-2 focus:ring-dash-ring/20"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="primary">
                Create Campaign
              </Button>
              <Button type="button" variant="dashboard" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

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
              <div
                key={campaign.id}
                className="rounded-xl border border-dash-border bg-dash-surface-subtle/50 p-5 shadow-sm"
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

                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-dash-text-muted">
                  <span>Started {formatDate(campaign.start_date)}</span>
                  {campaign.end_date && <span>Ends {formatDate(campaign.end_date)}</span>}
                  <span>{campaignDonations.length} donations</span>
                </div>
              </div>
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
                      Declared {g.declaration_date ? formatDate(g.declaration_date) : "—"}
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
