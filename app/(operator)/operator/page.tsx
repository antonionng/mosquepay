import {
  Building2,
  CreditCard,
  TrendingUp,
  Activity,
  ArrowUpRight,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { listLodges } from "@/lib/db";
import type { Lodge } from "@/lib/db/types";

async function getOperatorStats() {
  let lodges: Lodge[] = [];
  if (isSupabaseConfigured()) {
    try {
      lodges = await listLodges();
    } catch {
      lodges = [];
    }
  }

  const activeLodges = lodges.filter((l) => l.is_active);
  return {
    totalLodges: lodges.length,
    activeLodges: activeLodges.length,
    lodges,
  };
}

export default async function OperatorDashboard() {
  const stats = await getOperatorStats();

  const kpis = [
    {
      label: "Total Lodges",
      value: stats.totalLodges,
      icon: Building2,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Active Subscriptions",
      value: stats.activeLodges,
      icon: CreditCard,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Total Revenue",
      value: "£0",
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Recent Activity",
      value: stats.totalLodges > 0 ? "Active" : "None",
      icon: Activity,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Operator Dashboard</h1>
          <p className="admin-page-copy">
            Cross-lodge overview of your platform
          </p>
        </div>
        <Link
          href="/operator/lodges/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Building2 className="h-4 w-4" />
          Onboard New Lodge
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="admin-surface p-5">
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${kpi.bg}`}
                >
                  <Icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold text-white">
                {kpi.value}
              </p>
              <p className="mt-1 text-sm text-slate-400">{kpi.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="admin-surface p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">
              Revenue Trends
            </h2>
            <BarChart3 className="h-5 w-5 text-slate-400" />
          </div>
          <div className="flex h-52 items-center justify-center text-slate-500">
            <div className="text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-slate-600" />
              <p className="mt-3 text-sm">
                Revenue chart will appear once subscriptions are active
              </p>
            </div>
          </div>
        </div>

        <div className="admin-surface p-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <h2 className="text-lg font-semibold text-white">
              Recent Lodge Activity
            </h2>
            <Link
              href="/operator/lodges"
              className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
            >
              View all <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {stats.lodges.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-slate-500">
              <div className="text-center">
                <Building2 className="mx-auto h-10 w-10 text-slate-600" />
                <p className="mt-3 text-sm">
                  No lodges onboarded yet
                </p>
                <Link
                  href="/operator/lodges/new"
                  className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
                >
                  Onboard your first lodge →
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {stats.lodges.slice(0, 5).map((lodge) => (
                <Link
                  key={lodge.id}
                  href={`/operator/lodges/${lodge.slug}`}
                  className="flex items-center justify-between py-3 transition-colors hover:bg-white/[0.02] -mx-2 px-2 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-xs font-semibold text-white">
                      {lodge.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {lodge.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {lodge.city ?? "—"}{" "}
                        {lodge.country ? `· ${lodge.country}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      lodge.is_active
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {lodge.is_active ? "Active" : "Inactive"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
