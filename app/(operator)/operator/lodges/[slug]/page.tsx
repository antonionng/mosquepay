import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  MapPin,
  Mail,
  CreditCard,
  Calendar,
  Users,
  Globe,
  ArrowLeft,
  ExternalLink,
  Ban,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import type { Lodge, LodgeSubscription } from "@/lib/db/types";
import { LodgeDetailActions } from "./actions";

type Props = { params: Promise<{ slug: string }> };

async function getLodgeData(slug: string) {
  let lodge: Lodge | null = null;
  let subscription: LodgeSubscription | null = null;
  let eventsCount = 0;
  let leadsCount = 0;
  let paymentsTotal = 0;

  if (isSupabaseConfigured()) {
    lodge = await db.getLodgeBySlug(slug).catch(() => null);
    if (!lodge) {
      const allLodges = await db.listLodges().catch(() => []);
      lodge = allLodges.find((l) => l.slug === slug) ?? null;
    }
    if (lodge) {
      subscription = await db.getLodgeSubscription(lodge.id).catch(() => null);
      const events = await db.getEvents(lodge.id).catch(() => []);
      eventsCount = events.length;
      const leads = await db.getLeads(lodge.id).catch(() => []);
      leadsCount = leads.length;
      const payments = await db.getPayments(lodge.id).catch(() => []);
      paymentsTotal = payments.reduce((sum, p) => sum + p.total_amount, 0);
    }
  } else {
    const allLodges = mockDb.listLodges();
    lodge = allLodges.find((l: Lodge) => l.slug === slug) ?? null;
  }

  return { lodge, subscription, eventsCount, leadsCount, paymentsTotal };
}

export default async function LodgeDetailPage({ params }: Props) {
  const { slug } = await params;
  const { lodge, subscription, eventsCount, leadsCount, paymentsTotal } =
    await getLodgeData(slug);

  if (!lodge) notFound();

  const usageStats = [
    { label: "Events", value: eventsCount, icon: Calendar },
    { label: "Leads", value: leadsCount, icon: Users },
    {
      label: "Payments Total",
      value: `£${(paymentsTotal / 100).toFixed(2)}`,
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/operator/lodges"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Lodges
        </Link>
        <div className="admin-page-head">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-lg font-bold text-white">
              {lodge.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="admin-page-title">{lodge.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {lodge.city && (
                  <span className="flex items-center gap-1 text-sm text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> {lodge.city}
                    {lodge.country ? `, ${lodge.country}` : ""}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    lodge.is_active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {lodge.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/settings?lodge=${lodge.slug}`}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white transition-colors hover:bg-white/10"
            >
              <Globe className="h-4 w-4" />
              Site Builder
              <ExternalLink className="h-3 w-3 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="admin-surface p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
              Lodge Profile
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {[
                ["Name", lodge.name],
                ["Slug", lodge.slug],
                ["City", lodge.city ?? "—"],
                ["Country", lodge.country ?? "—"],
                ["Tagline", lodge.tagline ?? "—"],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs font-medium text-slate-500">{label}</p>
                  <p className="mt-0.5 text-sm text-white">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Support Email
                </p>
                <p className="mt-0.5 text-sm text-white">
                  {lodge.support_email ? (
                    <a
                      href={`mailto:${lodge.support_email}`}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      <Mail className="h-3 w-3" /> {lodge.support_email}
                    </a>
                  ) : (
                    "—"
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  Brand Colors
                </p>
                <div className="mt-1.5 flex gap-2">
                  <div
                    className="h-6 w-6 rounded-md border border-white/10"
                    style={{
                      backgroundColor: lodge.primary_color ?? "#1e3a5f",
                    }}
                  />
                  <div
                    className="h-6 w-6 rounded-md border border-white/10"
                    style={{
                      backgroundColor: lodge.secondary_color ?? "#d4af37",
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Created</p>
                <p className="mt-0.5 text-sm text-white">
                  {formatDate(lodge.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {usageStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="admin-surface p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-slate-400">{stat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="admin-surface p-6">
            <h2 className="text-lg font-semibold text-white border-b border-white/10 pb-4">
              Subscription
            </h2>
            {subscription ? (
              <div className="space-y-3 mt-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Plan</p>
                  <p className="mt-0.5 text-sm font-medium text-white capitalize">
                    {subscription.plan_code}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Status</p>
                  <span
                    className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      subscription.status === "active"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : subscription.status === "trialing"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {subscription.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Amount</p>
                  <p className="mt-0.5 text-sm text-white">
                    £{(subscription.amount / 100).toFixed(2)} /{" "}
                    {subscription.billing_cycle}
                  </p>
                </div>
                {subscription.current_period_end && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Next Payment
                    </p>
                    <p className="mt-0.5 text-sm text-white">
                      {formatDate(subscription.current_period_end)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 text-center py-6">
                <CreditCard className="mx-auto h-8 w-8 text-slate-600" />
                <p className="mt-2 text-sm text-slate-500">
                  No subscription yet
                </p>
              </div>
            )}
          </div>

          <LodgeDetailActions lodge={lodge} />
        </div>
      </div>
    </div>
  );
}
