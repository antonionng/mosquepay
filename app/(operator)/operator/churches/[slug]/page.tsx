import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Mail,
  CreditCard,
  Calendar,
  Users,
  Globe,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { formatDate } from "@/lib/utils";
import type { Church, ChurchSubscription } from "@/lib/db/types";
import { getPlanDefinition } from "@/lib/billing/plans";
import { ChurchDetailActions } from "./actions";
import { requireOperatorPageAccess } from "@/lib/auth/operator-page";

type Props = { params: Promise<{ slug: string }> };

async function getChurchData(slug: string) {
  let church: Church | null = null;
  let subscription: ChurchSubscription | null = null;
  let eventsCount = 0;
  let newcomersCount = 0;
  let paymentsTotal = 0;

  if (isSupabaseConfigured()) {
    church = await db.getChurchBySlug(slug).catch(() => null);
    if (!church) {
      const allChurches = await db.listChurches().catch(() => []);
      church = allChurches.find((l) => l.slug === slug) ?? null;
    }
    if (church) {
      subscription = await db.getChurchSubscription(church.id).catch(() => null);
      const events = await db.getEvents(church.id).catch(() => []);
      eventsCount = events.length;
      const newcomers = await db.getNewcomers(church.id).catch(() => []);
      newcomersCount = newcomers.length;
      const payments = await db.getPayments(church.id).catch(() => []);
      paymentsTotal = payments.reduce((sum, p) => sum + p.total_amount, 0);
    }
  } else if (shouldUseInMemoryMock()) {
    const allChurches = mockDb.listChurches();
    church = allChurches.find((l: Church) => l.slug === slug) ?? null;
  }

  return { church, subscription, eventsCount, newcomersCount, paymentsTotal };
}

export default async function ChurchDetailPage({ params }: Props) {
  await requireOperatorPageAccess();

  const { slug } = await params;
  const { church, subscription, eventsCount, newcomersCount, paymentsTotal } =
    await getChurchData(slug);

  if (!church) notFound();

  const usageStats = [
    { label: "Events", value: eventsCount, icon: Calendar },
    { label: "Newcomers", value: newcomersCount, icon: Users },
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
          href="/operator/churches"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Churches
        </Link>
        <div className="admin-page-head">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-lg font-bold text-white">
              {church.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="admin-page-title">{church.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {church.city && (
                  <span className="flex items-center gap-1 text-sm text-slate-400">
                    <MapPin className="h-3.5 w-3.5" /> {church.city}
                    {church.country ? `, ${church.country}` : ""}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    church.is_active
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {church.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/settings?church=${church.slug}`}
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
              Church Profile
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              {[
                ["Name", church.name],
                ["Slug", church.slug],
                ["City", church.city ?? "Not recorded"],
                ["Country", church.country ?? "Not recorded"],
                ["Tagline", church.tagline ?? "Not recorded"],
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
                  {church.support_email ? (
                    <a
                      href={`mailto:${church.support_email}`}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                    >
                      <Mail className="h-3 w-3" /> {church.support_email}
                    </a>
                  ) : (
                    "Not recorded"
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
                      backgroundColor: church.primary_color ?? "#1e3a5f",
                    }}
                  />
                  <div
                    className="h-6 w-6 rounded-md border border-white/10"
                    style={{
                      backgroundColor: church.secondary_color ?? "#d4af37",
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Created</p>
                <p className="mt-0.5 text-sm text-white">
                  {formatDate(church.created_at)}
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
                    {getPlanDefinition(subscription.plan_code).name}
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

          <ChurchDetailActions church={church} />
        </div>
      </div>
    </div>
  );
}
