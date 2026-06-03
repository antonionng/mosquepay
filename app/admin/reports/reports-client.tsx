"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Wallet,
  Heart,
  UserCheck,
  Building2,
  Download,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type {
  SecretaryReport,
  TreasurerReport,
  CharityReport,
  RecruitmentReport,
  OperatorReport,
  AnnualReturn,
} from "@/lib/reports";

type Tab = "secretary" | "treasurer" | "charity" | "recruitment" | "operator";

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: "secretary", label: "Secretary", icon: ClipboardList },
  { id: "treasurer", label: "Treasurer", icon: Wallet },
  { id: "charity", label: "Charity Steward", icon: Heart },
  { id: "recruitment", label: "Membership", icon: UserCheck },
  { id: "operator", label: "Operator", icon: Building2 },
];

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null>>
) {
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")
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

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card variant="kpi" className="dash-kpi-card h-full rounded-xl p-5">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-dash-text">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-dash-muted">{hint}</p>}
    </Card>
  );
}

export function ReportsClient({
  lodgeName,
  secretary,
  treasurer,
  charity,
  recruitment,
  annualReturn,
  operator,
}: {
  lodgeName: string;
  secretary: SecretaryReport;
  treasurer: TreasurerReport;
  charity: CharityReport;
  recruitment: RecruitmentReport;
  annualReturn: AnnualReturn;
  operator: OperatorReport | null;
}) {
  const [tab, setTab] = useState<Tab>("secretary");

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Reports</h1>
          <p className="admin-page-copy">
            Role-focused operational reports for {lodgeName}.
          </p>
        </div>
      </div>

      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        {TABS.filter((t) => t.id !== "operator" || operator).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-dash-ring bg-dash-ring/10 text-dash-ring"
                  : "border-dash-border bg-dash-surface text-dash-muted hover:border-dash-border-strong hover:text-dash-text"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "secretary" && <SecretaryView r={secretary} />}
      {tab === "treasurer" && <TreasurerView r={treasurer} />}
      {tab === "charity" && <CharityView r={charity} />}
      {tab === "recruitment" && (
        <RecruitmentView r={recruitment} annualReturn={annualReturn} />
      )}
      {tab === "operator" && operator && <OperatorView r={operator} />}
    </div>
  );
}

function SecretaryView({ r }: { r: SecretaryReport }) {
  function exportMeetings() {
    downloadCsv(
      "secretary-meetings.csv",
      ["Title", "Date", "Published", "RSVPs", "Ceremony", "Dining", "Summons sent"],
      r.meetingTable.map((m) => [
        m.title,
        m.date,
        m.published ? "yes" : "no",
        m.rsvpCount,
        m.ceremonyCount,
        m.diningCount,
        m.summonsSent,
      ])
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Meetings"
          value={`${r.totalMeetings}`}
          hint={`${r.upcomingMeetings} upcoming · ${r.publishedMeetings} published`}
        />
        <Kpi
          label="Summons"
          value={`${r.meetingsWithSummons}/${r.totalMeetings}`}
          hint={`${r.totalSummonsSends} sends recorded`}
        />
        <Kpi
          label="RSVPs"
          value={`${r.totalRsvps}`}
          hint={`${r.attendingCeremony} ceremony · ${r.attendingDining} dining`}
        />
        <Kpi
          label="Member data gaps"
          value={`${r.membersMissingAddress + r.membersMissingDietary}`}
          hint={`${r.membersMissingAddress} address · ${r.membersMissingDietary} dietary`}
        />
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Meeting readiness &amp; attendance</h2>
            <p className="dash-panel-header-description">
              Last 30 meetings, sorted by date.
            </p>
          </div>
          <Button variant="dashboard" size="sm" onClick={exportMeetings}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>
        <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
          {r.meetingTable.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dash-muted">
              No meetings yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Meeting</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3 text-right">RSVPs</th>
                  <th className="px-4 py-3 text-right">Ceremony</th>
                  <th className="px-4 py-3 text-right">Dining</th>
                  <th className="px-4 py-3 text-right">Summons sent</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {r.meetingTable.map((m) => (
                  <tr key={m.id} className="hover:bg-dash-surface-subtle/40">
                    <td className="px-4 py-3 font-medium text-dash-text">
                      <Link
                        href={`/admin/meetings/${m.id}`}
                        className="hover:text-dash-ring"
                      >
                        {m.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-dash-muted">{formatDate(m.date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.rsvpCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.ceremonyCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.diningCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.summonsSent}</td>
                    <td className="px-4 py-3">
                      {m.published ? (
                        <Badge variant="success" className="capitalize">Published</Badge>
                      ) : (
                        <Badge variant="warning" className="capitalize">Draft</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TreasurerView({ r }: { r: TreasurerReport }) {
  function exportOutstanding() {
    downloadCsv(
      "treasurer-outstanding-dues.csv",
      [
        "Member",
        "Email",
        "Amount",
        "Period end",
        "Status",
        "Payment method",
        "BACS monthly",
      ],
      r.outstandingDues.map((d) => [
        d.member_name ?? "",
        d.member_email,
        d.amount,
        d.period_end,
        d.status,
        methodLabelText(d.dues_payment_method),
        d.bacs_monthly_amount ?? "",
      ])
    );
  }
  function exportReconciliation() {
    downloadCsv(
      "treasurer-payments-reconciliation.csv",
      ["Payment ID", "Customer", "Total", "Refunded", "Status", "Completed", "Mooov reference"],
      r.reconciliation.map((p) => [
        p.id,
        p.user_name ?? "",
        p.total,
        p.refunded,
        p.status,
        p.completed_at ?? "",
        p.mooov_payment_id ?? p.stripe_payment_intent_id ?? "",
      ])
    );
  }

  const breakdown = r.duesPaymentMethodBreakdown;
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total paid" value={`£${r.totalPaid.toFixed(2)}`} hint={`£${r.totalRefunded.toFixed(2)} refunded`} />
        <Kpi label="Dues outstanding" value={`£${r.unpaidDuesTotal.toFixed(2)}`} hint={`${r.outstandingDues.length} members`} />
        <Kpi label="Dues paid" value={`£${r.paidDuesTotal.toFixed(2)}`} />
        <Kpi label="Dues Gift Aid" value={`£${r.duesGiftAidReclaimable.toFixed(2)}`} hint={`£${r.duesGiftAidEligible.toFixed(2)} eligible`} />
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Dues by payment method</h2>
            <p className="dash-panel-header-description">
              How members are paying this year, with expected amounts per
              bucket.
            </p>
          </div>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <BreakdownTile
              label="Online"
              count={breakdown.online_subscription}
              amount={breakdown.online_subscription_expected}
            />
            <BreakdownTile
              label="BACS"
              count={breakdown.bacs}
              amount={breakdown.bacs_annual_expected}
              footer={
                breakdown.bacs > 0
                  ? `£${breakdown.bacs_monthly_total.toFixed(2)} / mo`
                  : undefined
              }
            />
            <BreakdownTile
              label="Paid in full"
              count={breakdown.paid_in_full}
              amount={breakdown.paid_in_full_total}
            />
            <BreakdownTile
              label="Fee waived"
              count={breakdown.fee_waived}
              amount={breakdown.fee_waived_total}
            />
            <BreakdownTile
              label="Not tagged"
              count={breakdown.unset}
              amount={breakdown.unset_outstanding_total}
              tone="amber"
              footer={breakdown.unset > 0 ? "Outstanding" : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Outstanding dues</h2>
              <p className="dash-panel-header-description">Unpaid balances by member.</p>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportOutstanding} disabled={r.outstandingDues.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            {r.outstandingDues.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-dash-muted">All dues are settled.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">Period end</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {r.outstandingDues.map((d) => (
                    <tr key={`${d.member_email}-${d.period_end}`} className="hover:bg-dash-surface-subtle/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/members?q=${encodeURIComponent(d.member_email)}`}
                          className="hover:text-dash-ring"
                        >
                          <p className="font-medium text-dash-text">{d.member_name ?? "Unknown"}</p>
                          <p className="text-xs text-dash-muted">{d.member_email}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">£{d.amount.toFixed(2)}</td>
                      <td className="px-4 py-3 text-dash-muted">{formatDate(d.period_end)}</td>
                      <td className="px-4 py-3 text-xs">
                        {methodLabelText(d.dues_payment_method)}
                        {d.dues_payment_method === "bacs" && d.bacs_monthly_amount != null
                          ? ` · £${d.bacs_monthly_amount.toFixed(2)}/mo`
                          : ""}
                      </td>
                      <td className="px-4 py-3 capitalize">{d.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Mooov reconciliation</h2>
              <p className="dash-panel-header-description">Recent payments with refunds.</p>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportReconciliation} disabled={r.reconciliation.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            {r.reconciliation.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-dash-muted">No payments recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Refund</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {r.reconciliation.slice(0, 25).map((p) => (
                    <tr key={p.id} className="hover:bg-dash-surface-subtle/40">
                      <td className="px-4 py-3">
                        <Link href={`/admin/payments/${p.id}`} className="hover:text-dash-ring">
                          <p className="font-medium text-dash-text">{p.user_name ?? "Customer"}</p>
                          <p className="text-xs text-dash-muted">
                            {p.completed_at ? formatDate(p.completed_at) : "Pending"}
                          </p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">£{p.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.refunded > 0 ? `£${p.refunded.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CharityView({ r }: { r: CharityReport }) {
  function exportCampaigns() {
    downloadCsv(
      "charity-campaigns.csv",
      ["Name", "Status", "Target", "Raised", "Donations", "Progress %"],
      r.campaignSummary.map((c) => [c.name, c.status, c.target, c.raised, c.donations, c.pct])
    );
  }
  function exportDonors() {
    downloadCsv(
      "charity-donor-history.csv",
      ["Name", "Email", "Total", "Donations", "Gift Aid"],
      r.donorHistory.map((d) => [d.name, d.email, d.total, d.donations, d.giftAid ? "yes" : "no"])
    );
  }
  function exportCollections() {
    downloadCsv(
      "charity-meeting-collections.csv",
      ["Meeting", "Donations", "Total"],
      r.meetingCollections.map((c) => [c.eventTitle, c.count, c.total])
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total raised" value={`£${r.totalRaised.toFixed(2)}`} hint={`${r.donationCount} donations`} />
        <Kpi label="Active campaigns" value={`${r.campaignCount}`} />
        <Kpi label="Gift Aid reclaimable" value={`£${r.giftAidReclaimable.toFixed(2)}`} />
        <Kpi label="GASDS reclaimable" value={`£${r.gasdsReclaimable.toFixed(2)}`} hint={`£${r.gasdsEligible.toFixed(2)} eligible cash`} />
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Campaigns</h2>
          </div>
          <Button variant="dashboard" size="sm" onClick={exportCampaigns} disabled={r.campaignSummary.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>
        <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
          {r.campaignSummary.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dash-muted">No campaigns yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Target</th>
                  <th className="px-4 py-3 text-right">Raised</th>
                  <th className="px-4 py-3 text-right">Donations</th>
                  <th className="px-4 py-3 text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {r.campaignSummary.map((c) => (
                  <tr key={c.id} className="hover:bg-dash-surface-subtle/40">
                    <td className="px-4 py-3 font-medium text-dash-text">
                      <Link href={`/admin/charity/${c.id}`} className="hover:text-dash-ring">
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{c.status}</td>
                    <td className="px-4 py-3 text-right tabular-nums">£{c.target.toFixed(0)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">£{c.raised.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.donations}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Donor history</h2>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportDonors} disabled={r.donorHistory.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            {r.donorHistory.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-dash-muted">No donations.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                    <th className="px-4 py-3">Donor</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-right">Donations</th>
                    <th className="px-4 py-3">Gift Aid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border">
                  {r.donorHistory.slice(0, 25).map((d) => (
                    <tr key={d.email}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-dash-text">{d.name}</p>
                        <p className="text-xs text-dash-muted">{d.email}</p>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">£{d.total.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{d.donations}</td>
                      <td className="px-4 py-3">
                        {d.giftAid ? (
                          <Badge variant="success">Declared</Badge>
                        ) : (
                          <Badge variant="outline" className="text-dash-muted">Missing</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Meeting collections</h2>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportCollections} disabled={r.meetingCollections.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            {r.meetingCollections.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-dash-muted">No meeting-linked donations.</p>
            ) : (
              <ul className="divide-y divide-dash-border">
                {r.meetingCollections.map((c) => (
                  <li key={c.eventId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <Link
                      href={`/admin/meetings/${c.eventId}`}
                      className="font-medium text-dash-text hover:text-dash-ring"
                    >
                      {c.eventTitle}
                    </Link>
                    <span className="text-xs text-dash-muted">{c.count} donations</span>
                    <span className="font-semibold tabular-nums text-dash-text">£{c.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RecruitmentView({
  r,
  annualReturn,
}: {
  r: RecruitmentReport;
  annualReturn: AnnualReturn;
}) {
  function exportAnnualReturn() {
    downloadCsv(
      `membership-annual-return-${annualReturn.periodStart}.csv`,
      [
        "Name",
        "Email",
        "Rank",
        "Office",
        "Status",
        "Royal Arch",
        "Honorary",
        "Initiated",
        "Passed",
        "Raised",
        "Age",
      ],
      annualReturn.members.map((m) => [
        m.name,
        m.email,
        m.rank ?? "",
        m.office ?? "",
        m.status,
        m.royalArch ? "yes" : "no",
        m.honorary ? "yes" : "no",
        m.dateOfInitiation ?? "",
        m.dateOfPassing ?? "",
        m.dateOfRaising ?? "",
        m.age ?? "",
      ]),
    );
  }
  function exportSources() {
    downloadCsv(
      "recruitment-sources.csv",
      ["Source", "Leads", "Converted"],
      r.bySource.map((s) => [s.source, s.count, s.converted])
    );
  }
  function exportStages() {
    downloadCsv(
      "recruitment-stages.csv",
      ["Stage", "Count", "Avg age (days)"],
      r.byStage.map((s) => [s.stage, s.count, s.avgAgeDays])
    );
  }
  function exportStale() {
    downloadCsv(
      "recruitment-stale-leads.csv",
      ["Name", "Email", "Stage", "Days since update"],
      r.staleList.map((s) => [s.name, s.email, s.stage, s.daysSinceUpdate])
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Membership annual return</h2>
            <p className="dash-panel-header-description">
              Return year {annualReturn.periodLabel} · roll of{" "}
              {annualReturn.totalMembers} member
              {annualReturn.totalMembers === 1 ? "" : "s"} for the UGLE /
              Provincial annual return.
            </p>
          </div>
          <Button
            variant="dashboard"
            size="sm"
            onClick={exportAnnualReturn}
            disabled={annualReturn.totalMembers === 0}
          >
            <Download className="mr-1.5 h-4 w-4" /> Annual return CSV
          </Button>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-5">
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Active" value={`${annualReturn.active}`} />
            <Kpi label="Suspended" value={`${annualReturn.suspended}`} />
            <Kpi label="Resigned" value={`${annualReturn.resigned}`} />
            <Kpi label="Excluded" value={`${annualReturn.excluded}`} />
            <Kpi label="Royal Arch" value={`${annualReturn.royalArch}`} />
            <Kpi
              label="Average age"
              value={
                annualReturn.averageAge != null
                  ? `${annualReturn.averageAge}`
                  : "—"
              }
            />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Kpi
              label="Initiations this year"
              value={`${annualReturn.initiationsInYear}`}
            />
            <Kpi
              label="Passings this year"
              value={`${annualReturn.passingsInYear}`}
            />
            <Kpi
              label="Raisings this year"
              value={`${annualReturn.raisingsInYear}`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total leads" value={`${r.totalLeads}`} />
        <Kpi label="New this month" value={`${r.newThisMonth}`} />
        <Kpi label="Conversion rate" value={`${r.conversionRate}%`} />
        <Kpi label="Stale (30d+)" value={`${r.staleLeads}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">By source</h2>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportSources} disabled={r.bySource.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Converted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {r.bySource.map((s) => (
                  <tr key={s.source}>
                    <td className="px-4 py-3 capitalize">{s.source}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.converted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h2 className="dash-panel-header-title">Stage ageing</h2>
            </div>
            <Button variant="dashboard" size="sm" onClick={exportStages} disabled={r.byStage.length === 0}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
          </div>
          <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Count</th>
                  <th className="px-4 py-3 text-right">Avg age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {r.byStage.map((s) => (
                  <tr key={s.stage}>
                    <td className="px-4 py-3 capitalize">{s.stage}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.avgAgeDays}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Leads needing attention</h2>
            <p className="dash-panel-header-description">No activity in 30+ days.</p>
          </div>
          <Button variant="dashboard" size="sm" onClick={exportStale} disabled={r.staleList.length === 0}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>
        <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
          {r.staleList.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dash-muted">All leads have recent activity.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3 text-right">Days since update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {r.staleList.map((s) => (
                  <tr key={s.id} className="hover:bg-dash-surface-subtle/40">
                    <td className="px-4 py-3">
                      <Link href={`/admin/leads/${s.id}`} className="hover:text-dash-ring">
                        <p className="font-medium text-dash-text">{s.name}</p>
                        <p className="text-xs text-dash-muted">{s.email}</p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 capitalize">{s.stage}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{s.daysSinceUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OperatorView({ r }: { r: OperatorReport }) {
  function exportLodges() {
    downloadCsv(
      "operator-lodges.csv",
      [
        "Name",
        "Slug",
        "Health score",
        "Members",
        "Upcoming meetings",
        "Payments (30d)",
        "Risk",
      ],
      r.lodgeRows.map((l) => [
        l.name,
        l.slug,
        l.healthScore,
        l.members,
        l.upcomingMeetings,
        l.paymentsLast30,
        l.risk,
      ])
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Lodges" value={`${r.totalLodges}`} />
        <Kpi label="Active" value={`${r.activeLodges}`} />
        <Kpi label="Inactive" value={`${r.inactiveLodges}`} />
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Lodge health</h2>
            <p className="dash-panel-header-description">
              Composite score from membership, upcoming meetings, and recent payments.
            </p>
          </div>
          <Button variant="dashboard" size="sm" onClick={exportLodges}>
            <Download className="mr-1.5 h-4 w-4" /> CSV
          </Button>
        </div>
        <CardContent className="admin-table-scroll border-t border-dash-border bg-dash-surface p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                <th className="px-4 py-3">Lodge</th>
                <th className="px-4 py-3 text-right">Members</th>
                <th className="px-4 py-3 text-right">Upcoming</th>
                <th className="px-4 py-3 text-right">Payments (30d)</th>
                <th className="px-4 py-3 text-right">Score</th>
                <th className="px-4 py-3">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {r.lodgeRows.map((l) => (
                <tr key={l.id} className="hover:bg-dash-surface-subtle/40">
                  <td className="px-4 py-3">
                    <Link href={`/operator/lodges/${l.slug}`} className="hover:text-dash-ring">
                      <p className="font-medium text-dash-text">{l.name}</p>
                      <p className="text-xs text-dash-muted">{l.slug}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.members}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.upcomingMeetings}</td>
                  <td className="px-4 py-3 text-right tabular-nums">£{l.paymentsLast30.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{l.healthScore}</td>
                  <td className="px-4 py-3">
                    {l.risk === "ok" ? (
                      <Badge variant="success">Healthy</Badge>
                    ) : l.risk === "watch" ? (
                      <Badge variant="warning">Watch</Badge>
                    ) : (
                      <Badge variant="destructive">At risk</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers used by TreasurerView's payment-method breakdown
// ---------------------------------------------------------------------------

function methodLabelText(
  m: "online_subscription" | "bacs" | "paid_in_full" | "fee_waived" | null,
): string {
  if (m === "online_subscription") return "Online";
  if (m === "bacs") return "BACS";
  if (m === "paid_in_full") return "Paid in full";
  if (m === "fee_waived") return "Waived";
  return "Not tagged";
}

function BreakdownTile({
  label,
  count,
  amount,
  footer,
  tone = "default",
}: {
  label: string;
  count: number;
  amount: number;
  footer?: string;
  tone?: "default" | "amber";
}) {
  const ring =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/50"
      : "border-slate-200 bg-slate-50/40";
  return (
    <div className={`rounded-xl border p-3 ${ring}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-dash-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-dash-text">
        {count}
        <span className="ml-1 text-xs font-normal text-dash-muted">
          {count === 1 ? "member" : "members"}
        </span>
      </p>
      <p className="mt-0.5 text-sm font-medium tabular-nums text-dash-text">
        £{amount.toFixed(2)}
      </p>
      {footer ? (
        <p className="mt-0.5 text-[11px] text-dash-muted">{footer}</p>
      ) : null}
    </div>
  );
}
