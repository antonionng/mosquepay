import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { listLodges, getLodgeSubscription } from "@/lib/db";
import type { Lodge, LodgeSubscription } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";
import { getPlanDefinition } from "@/lib/billing/plans";

type LodgeWithSub = {
  lodge: Lodge;
  subscription: LodgeSubscription | null;
};

async function getBillingData(): Promise<LodgeWithSub[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const lodges = await listLodges();
    const results = await Promise.all(
      lodges.map(async (lodge) => {
        const subscription = await getLodgeSubscription(lodge.id).catch(
          () => null
        );
        return { lodge, subscription };
      })
    );
    return results;
  } catch {
    return [];
  }
}

function statusIcon(status: string) {
  switch (status) {
    case "active":
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
    case "trialing":
      return <Clock className="h-3.5 w-3.5 text-amber-400" />;
    case "canceled":
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    default:
      return <AlertCircle className="h-3.5 w-3.5 text-slate-400" />;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-400",
    trialing: "bg-amber-500/10 text-amber-400",
    canceled: "bg-red-500/10 text-red-400",
    cancelled: "bg-red-500/10 text-red-400",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${map[status] ?? "bg-slate-500/10 text-slate-400"}`}
    >
      {statusIcon(status)}
      {status}
    </span>
  );
}

export default async function BillingPage() {
  const data = await getBillingData();

  const withSub = data.filter((d) => d.subscription);
  const activeCount = withSub.filter(
    (d) => d.subscription?.status === "active"
  ).length;
  const trialingCount = withSub.filter(
    (d) => d.subscription?.status === "trialing"
  ).length;
  const totalMrr = withSub
    .filter((d) => d.subscription?.status === "active")
    .reduce((sum, d) => sum + (d.subscription?.amount ?? 0), 0);

  const summaryCards = [
    {
      label: "Total Subscriptions",
      value: withSub.length,
      icon: CreditCard,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active",
      value: activeCount,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Trialing",
      value: trialingCount,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Monthly Revenue",
      value: `£${(totalMrr / 100).toFixed(2)}`,
      icon: TrendingUp,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Billing</h1>
          <p className="admin-page-copy">
            Lodge subscriptions and revenue overview
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="admin-surface p-5">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}
                >
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-xl font-semibold text-white">
                    {card.value}
                  </p>
                  <p className="text-xs text-slate-400">{card.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 ? (
        <div className="admin-surface p-10 text-center">
          <CreditCard className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">
            No lodge subscriptions found
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Subscriptions will appear here once lodges are onboarded
          </p>
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Lodge</th>
                <th>Plan</th>
                <th>Status</th>
                <th className="hidden sm:table-cell">Amount</th>
                <th className="hidden md:table-cell">Billing Cycle</th>
                <th className="hidden lg:table-cell">Next Payment</th>
              </tr>
            </thead>
            <tbody>
              {data.map(({ lodge, subscription: sub }) => (
                <tr key={lodge.id}>
                  <td>
                    <Link
                      href={`/operator/lodges/${lodge.slug}`}
                      className="font-medium text-white hover:text-blue-400 transition-colors"
                    >
                      {lodge.name}
                    </Link>
                  </td>
                  <td className="text-slate-300 capitalize">
                    {sub ? getPlanDefinition(sub.plan_code).name : "Not recorded"}
                  </td>
                  <td>{sub ? statusBadge(sub.status) : statusBadge("none")}</td>
                  <td className="hidden sm:table-cell text-slate-300">
                    {sub ? `£${(sub.amount / 100).toFixed(2)}` : "Not recorded"}
                  </td>
                  <td className="hidden md:table-cell text-slate-400 capitalize">
                    {sub?.billing_cycle ?? "Not recorded"}
                  </td>
                  <td className="hidden lg:table-cell text-slate-400">
                    {sub?.current_period_end
                      ? formatDate(sub.current_period_end)
                      : "Not recorded"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
