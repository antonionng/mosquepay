"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Download,
  Pause,
  Play,
  CheckCircle2,
  Loader2,
  Save,
  Shield,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  raised_amount: number;
  status: "active" | "completed" | "paused";
  start_date: string;
  end_date: string | null;
};

type Donation = {
  id: string;
  donor_name: string | null;
  donor_email: string;
  amount: number;
  source: string;
  status: string;
  event_id: string | null;
  campaign_id: string | null;
  gift_aid_status: "unknown" | "eligible" | "declared" | "declined";
  gift_aid_declaration_id: string | null;
  created_at: string;
};

const STATUS_BADGE: Record<Campaign["status"], string> = {
  active: "border-blue-200 bg-blue-50 text-blue-900",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  paused: "border-amber-200 bg-amber-50 text-amber-900",
};

export function CharityCampaignDetailClient({
  campaign,
  donations,
  eventTitleMap,
  giftAidEmails,
}: {
  campaign: Campaign;
  donations: Donation[];
  eventTitleMap: Array<[string, string]>;
  giftAidEmails: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [target, setTarget] = useState(String(campaign.target_amount));
  const [endDate, setEndDate] = useState(
    campaign.end_date ? campaign.end_date.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eventNames = useMemo(
    () => new Map(eventTitleMap),
    [eventTitleMap]
  );
  const giftAidSet = useMemo(
    () => new Set(giftAidEmails),
    [giftAidEmails]
  );

  const totalDonated = donations.reduce((s, d) => s + d.amount, 0);
  const completed = donations.filter((d) => d.status === "completed");
  const serviceCollections = donations.filter((d) => d.event_id);
  const giftAidEligibleAmount = donations.reduce(
    (sum, d) =>
      d.gift_aid_status === "declared" || giftAidSet.has(d.donor_email.toLowerCase())
        ? sum + d.amount
        : sum,
    0
  );
  const reclaimable = giftAidEligibleAmount * 0.25;

  const donorRows = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        email: string;
        total: number;
        count: number;
        giftAid: boolean;
        giftAidStatus: string;
      }
    >();
    for (const d of donations) {
      const key = d.donor_email.toLowerCase();
      const cur = map.get(key) ?? {
        name: d.donor_name ?? "Anonymous",
        email: d.donor_email,
        total: 0,
        count: 0,
        giftAid: false,
        giftAidStatus: "unknown",
      };
      cur.total += d.amount;
      cur.count += 1;
      const hasDecl = giftAidSet.has(key) || d.gift_aid_status === "declared";
      if (hasDecl) {
        cur.giftAid = true;
        cur.giftAidStatus = "declared";
      } else if (d.gift_aid_status === "eligible" && cur.giftAidStatus !== "declared") {
        cur.giftAidStatus = "eligible";
      } else if (d.gift_aid_status === "declined" && cur.giftAidStatus === "unknown") {
        cur.giftAidStatus = "declined";
      }
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [donations, giftAidSet]);

  const collectionsByEvent = useMemo(() => {
    const map = new Map<string, { eventId: string; total: number; count: number }>();
    for (const d of serviceCollections) {
      if (!d.event_id) continue;
      const cur = map.get(d.event_id) ?? {
        eventId: d.event_id,
        total: 0,
        count: 0,
      };
      cur.total += d.amount;
      cur.count += 1;
      map.set(d.event_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [serviceCollections]);

  function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
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

  function exportDonations() {
    downloadCsv(
      `${campaign.name}-donations.csv`,
      ["Date", "Donor", "Email", "Amount", "Source", "Event", "Status", "Gift Aid"],
      donations.map((d) => [
        d.created_at,
        d.donor_name ?? "Anonymous",
        d.donor_email,
        d.amount,
        d.source,
        d.event_id ? eventNames.get(d.event_id) ?? "" : "",
        d.status,
        giftAidSet.has(d.donor_email.toLowerCase()) || d.gift_aid_status === "declared"
          ? "yes"
          : d.gift_aid_status,
      ])
    );
  }

  function exportGiftAidHmrc() {
    const eligible = donorRows.filter((d) => d.giftAid);
    downloadCsv(
      `${campaign.name}-gift-aid-hmrc.csv`,
      ["Title", "First name", "Last name", "House name or number", "Postcode", "Aggregated donations"],
      eligible.map((d) => {
        const parts = (d.name || "").split(/\s+/);
        const first = parts[0] ?? "";
        const last = parts.slice(1).join(" ") || "";
        return ["", first, last, "", "", d.total.toFixed(2)];
      })
    );
  }

  async function updateStatus(next: Campaign["status"]) {
    await fetch(`/api/charity-campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    router.refresh();
  }

  async function saveEdits() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/charity-campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          target_amount: Number(target),
          end_date: endDate || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const pct = Math.min(
    100,
    Math.round((campaign.raised_amount / Math.max(campaign.target_amount, 1)) * 100)
  );

  return (
    <div className="space-y-5 sm:space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="text-dash-muted">
          <Link href="/admin/charity" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Charity
          </Link>
        </Button>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Target (£)</Label>
                      <Input
                        type="number"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">End date</Label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-dash-text">
                      {campaign.name}
                    </h1>
                    <Badge
                      variant="outline"
                      className={`capitalize ${STATUS_BADGE[campaign.status]}`}
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="mt-2 text-sm text-dash-muted">
                      {campaign.description}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="text-left md:text-right">
              <p className="text-3xl font-bold tabular-nums text-dash-text">
                £{campaign.raised_amount.toLocaleString()}
              </p>
              <p className="text-xs text-dash-muted">
                of £{campaign.target_amount.toLocaleString()} target ({pct}%)
              </p>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-dash-border">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editing ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saveEdits}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-3.5 w-3.5" /> Save changes
                    </span>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </Button>
                {error && <p className="text-xs text-red-600">{error}</p>}
              </>
            ) : (
              <>
                <Button
                  variant="dashboard"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  Edit details
                </Button>
                {campaign.status !== "active" && (
                  <Button
                    variant="dashboard"
                    size="sm"
                    onClick={() => updateStatus("active")}
                  >
                    <Play className="mr-1.5 h-3.5 w-3.5" /> Set active
                  </Button>
                )}
                {campaign.status !== "paused" && (
                  <Button
                    variant="dashboard"
                    size="sm"
                    onClick={() => updateStatus("paused")}
                  >
                    <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause
                  </Button>
                )}
                {campaign.status !== "completed" && (
                  <Button
                    variant="dashboard"
                    size="sm"
                    onClick={() => updateStatus("completed")}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Complete
                  </Button>
                )}
              </>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="dashboard"
                size="sm"
                onClick={exportDonations}
                disabled={donations.length === 0}
              >
                <Download className="mr-1.5 h-4 w-4" /> Donations CSV
              </Button>
              <Button
                variant="dashboard"
                size="sm"
                onClick={exportGiftAidHmrc}
                disabled={donorRows.filter((d) => d.giftAid).length === 0}
              >
                <Shield className="mr-1.5 h-4 w-4" /> Gift Aid (HMRC)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card variant="panel" className="overflow-hidden p-0">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h3 className="dash-panel-header-title">Totals</h3>
            </div>
          </div>
          <CardContent className="space-y-3 border-t border-dash-border bg-dash-surface p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-dash-muted">Donations recorded</span>
              <span className="font-semibold text-dash-text">
                {donations.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dash-muted">Total donated</span>
              <span className="font-semibold text-dash-text">
                £{totalDonated.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dash-muted">Completed</span>
              <span className="font-semibold text-dash-text">
                {completed.length} / {donations.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dash-muted">Gift Aid donors</span>
              <span className="font-semibold text-dash-text">
                {donorRows.filter((d) => d.giftAid).length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-dash-muted">Reclaimable</span>
              <span className="font-semibold text-emerald-700">
                £{reclaimable.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card variant="panel" className="overflow-hidden p-0 lg:col-span-2">
          <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
            <div>
              <h3 className="dash-panel-header-title">Service collections</h3>
              <p className="dash-panel-header-description">
                Charity collections linked to specific services.
              </p>
            </div>
          </div>
          <CardContent className="border-t border-dash-border bg-dash-surface p-5">
            {collectionsByEvent.length === 0 ? (
              <p className="text-sm text-dash-muted">
                No service-linked collections recorded for this campaign.
              </p>
            ) : (
              <ul className="divide-y divide-dash-border">
                {collectionsByEvent.map((row) => (
                  <li
                    key={row.eventId}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <Link
                      href={`/admin/services`}
                      className="font-medium text-dash-text hover:underline"
                    >
                      {eventNames.get(row.eventId) ?? "Service"}
                    </Link>
                    <span className="text-xs text-dash-muted">
                      {row.count} donation{row.count === 1 ? "" : "s"}
                    </span>
                    <span className="font-semibold tabular-nums text-dash-text">
                      £{row.total.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h3 className="dash-panel-header-title">Donors</h3>
            <p className="dash-panel-header-description">
              Aggregated by donor email, with Gift Aid status.
            </p>
          </div>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-0">
          {donorRows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-dash-muted">
              No donors yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface-subtle text-left text-xs uppercase tracking-wider text-dash-muted">
                  <th className="px-4 py-3">Donor</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Donations</th>
                  <th className="px-4 py-3">Gift Aid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {donorRows.map((d) => (
                  <tr key={d.email}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-dash-text">{d.name}</p>
                      <p className="text-xs text-dash-muted">{d.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums text-dash-text">
                      £{d.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-dash-muted">{d.count}</td>
                    <td className="px-4 py-3">
                      {d.giftAid ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-emerald-900"
                        >
                          Declared
                        </Badge>
                      ) : d.giftAidStatus === "eligible" ? (
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-900"
                        >
                          Eligible · needs declaration
                        </Badge>
                      ) : d.giftAidStatus === "declined" ? (
                        <Badge
                          variant="outline"
                          className="border-slate-200 bg-slate-50 text-slate-700"
                        >
                          Declined
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-dash-border bg-dash-surface text-dash-muted"
                        >
                          Unknown
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-dash-muted">
        Started {formatDate(campaign.start_date)}
        {campaign.end_date ? ` · Ends ${formatDate(campaign.end_date)}` : ""}
      </p>
    </div>
  );
}
