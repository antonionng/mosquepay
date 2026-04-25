"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CreditCard,
  Wallet,
  Heart,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface DashboardData {
  user: { full_name?: string; email?: string } | null;
  upcomingEvents: number;
  outstandingDues: number;
  recentPaymentsTotal: number;
  donationTotal: number;
  recentActivity: {
    id: string;
    type: "payment" | "event" | "donation" | "dues";
    description: string;
    date: string;
    amount?: number;
  }[];
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-10 w-10 rounded-xl bg-slate-100" />
        <div className="h-4 w-16 rounded bg-slate-100" />
      </div>
      <div className="h-8 w-24 rounded bg-slate-100 mb-1" />
      <div className="h-4 w-32 rounded bg-slate-100" />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500 mt-1">{label}</p>
      {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

const activityIcons = {
  payment: CreditCard,
  event: Calendar,
  donation: Heart,
  dues: Wallet,
};

const activityColors = {
  payment: "bg-emerald-50 text-emerald-600",
  event: "bg-blue-50 text-blue-600",
  donation: "bg-pink-50 text-pink-600",
  dues: "bg-amber-50 text-amber-600",
};

export default function MemberDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/member/dashboard");
        if (res.ok) {
          setData(await res.json());
        } else {
          setData({
            user: null,
            upcomingEvents: 0,
            outstandingDues: 0,
            recentPaymentsTotal: 0,
            donationTotal: 0,
            recentActivity: [],
          });
        }
      } catch {
        setData({
          user: null,
          upcomingEvents: 0,
          outstandingDues: 0,
          recentPaymentsTotal: 0,
          donationTotal: 0,
          recentActivity: [],
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const userName = data?.user?.full_name || "Member";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {loading ? (
            <span className="inline-block h-8 w-48 animate-pulse rounded bg-slate-100" />
          ) : (
            <>Welcome back, {userName}</>
          )}
        </h1>
        <p className="text-slate-500 mt-1">Here&apos;s an overview of your membership</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <StatCard
              icon={Calendar}
              label="Upcoming Events"
              value={String(data?.upcomingEvents ?? 0)}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              icon={Wallet}
              label="Outstanding Dues"
              value={`£${(data?.outstandingDues ?? 0).toFixed(2)}`}
              subtext={data?.outstandingDues ? "Payment due" : "All clear"}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              icon={CreditCard}
              label="Recent Payments"
              value={`£${(data?.recentPaymentsTotal ?? 0).toFixed(2)}`}
              subtext="Last 30 days"
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatCard
              icon={Heart}
              label="Donations This Year"
              value={`£${(data?.donationTotal ?? 0).toFixed(2)}`}
              iconBg="bg-pink-50"
              iconColor="text-pink-600"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link
          href="/member/events"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 group-hover:bg-blue-100 transition-colors">
            <Calendar className="h-6 w-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">RSVP to Event</p>
            <p className="text-xs text-slate-500">View upcoming events</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
        </Link>

        <Link
          href="/member/dues"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-amber-200 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 group-hover:bg-amber-100 transition-colors">
            <Wallet className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Pay Dues</p>
            <p className="text-xs text-slate-500">View and pay outstanding dues</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-500 transition-colors" />
        </Link>

        <Link
          href="/member/donations"
          className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-pink-200 hover:shadow-md transition-all"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-50 group-hover:bg-pink-100 transition-colors">
            <Heart className="h-6 w-6 text-pink-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">Make Donation</p>
            <p className="text-xs text-slate-500">Support the lodge</p>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-pink-500 transition-colors" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <TrendingUp className="h-4 w-4 text-slate-400" />
        </div>
        <div className="divide-y divide-slate-100">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-slate-100" />
                  <div className="h-3 w-24 rounded bg-slate-100" />
                </div>
              </div>
            ))
          ) : data?.recentActivity && data.recentActivity.length > 0 ? (
            data.recentActivity.map((activity) => {
              const Icon = activityIcons[activity.type];
              const colors = activityColors[activity.type];
              return (
                <div key={activity.id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${colors}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">{activity.description}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {activity.date}
                    </p>
                  </div>
                  {activity.amount != null && (
                    <p className="text-sm font-medium text-slate-900">
                      £{activity.amount.toFixed(2)}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
                <CheckCircle2 className="h-6 w-6 text-slate-300" />
              </div>
              <p className="text-sm font-medium text-slate-500">No recent activity</p>
              <p className="text-xs text-slate-400 mt-1">Your activity will appear here</p>
            </div>
          )}
        </div>
      </div>

      {!loading && data?.outstandingDues != null && data.outstandingDues > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              You have outstanding dues of £{data.outstandingDues.toFixed(2)}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Please pay at your earliest convenience.
            </p>
          </div>
          <Link href="/member/dues">
            <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors">
              Pay Now
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
