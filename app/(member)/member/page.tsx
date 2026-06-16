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
  FileText,
  User,
  IdCard,
} from "lucide-react";
import { NextServiceCard } from "@/components/member/next-service-card";

interface DashboardData {
  user: {
    full_name?: string;
    email?: string;
    phone?: string | null;
    dietary_requirements?: string | null;
    rank?: string | null;
    membership_status?: string;
  } | null;
  nextEvent: {
    id: string;
    title: string;
    slug: string;
    event_date: string;
    event_time: string | null;
    location: string | null;
    dress_code: string | null;
    enable_rsvp: boolean;
    enable_dining_rsvp: boolean;
    dining_price: number | null;
    current_rsvp: {
      id: string;
      status: string;
      attending_ceremony: boolean;
      attending_dining: boolean;
    } | null;
  } | null;
  upcomingEvents: number;
  outstandingGiving: number;
  recentPaymentsTotal: number;
  donationTotal: number;
  noticeLinks: {
    id: string;
    eventId: string;
    title: string;
    eventDate: string | null;
    sentAt: string;
    accessedAt: string | null;
    accessCount: number;
  }[];
  rsvps: {
    id: string;
    eventId: string;
    eventTitle: string;
    eventDate: string | null;
    status: string;
    attendingDining: boolean;
    guests: number;
    dietary: string | null;
    paymentRequired: boolean;
    paymentCompleted: boolean;
  }[];
  notices: {
    id: string;
    title: string;
    date: string;
    text: string;
  }[];
  recentActivity: {
    id: string;
    type: "payment" | "event" | "donation" | "giving";
    description: string;
    date: string;
    amount?: number;
  }[];
}

function SkeletonCard() {
  return (
    <div className="dash-kpi-card animate-pulse">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl bg-dash-surface-subtle" />
        <div className="h-4 w-16 rounded bg-dash-surface-subtle" />
      </div>
      <div className="mb-1 h-8 w-24 rounded bg-dash-surface-subtle" />
      <div className="h-4 w-32 rounded bg-dash-surface-subtle" />
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
    <div className="dash-kpi-card p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-10 sm:w-10 ${iconBg}`}>
          <Icon className={`h-4 w-4 sm:h-5 sm:w-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-xl font-bold text-dash-text sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-dash-muted sm:mt-1 sm:text-sm">{label}</p>
      {subtext && <p className="mt-0.5 text-[10px] text-dash-faint sm:text-xs">{subtext}</p>}
    </div>
  );
}

const activityIcons = {
  payment: CreditCard,
  event: Calendar,
  donation: Heart,
  giving: Wallet,
};

const activityColors = {
  payment: "bg-emerald-50 text-emerald-600",
  event: "bg-[hsl(var(--dash-ring)/0.1)] text-[hsl(var(--dash-ring))]",
  donation: "bg-pink-50 text-pink-600",
  giving: "bg-amber-50 text-amber-600",
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
            nextEvent: null,
            upcomingEvents: 0,
            outstandingGiving: 0,
            recentPaymentsTotal: 0,
            donationTotal: 0,
            noticeLinks: [],
            rsvps: [],
            notices: [],
            recentActivity: [],
          });
        }
      } catch {
        setData({
          user: null,
          nextEvent: null,
          upcomingEvents: 0,
          outstandingGiving: 0,
          recentPaymentsTotal: 0,
          donationTotal: 0,
          noticeLinks: [],
          rsvps: [],
          notices: [],
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
    <div className="mx-auto max-w-6xl space-y-5 sm:space-y-8">
      {/* Welcome block: hidden on phone because the top app bar already
          shows "Dashboard" and the user's name lives in the sidebar /
          profile tab. Bringing it back at sm+ where the breathing room
          is available. */}
      <div className="hidden sm:block">
        <h1 className="text-2xl font-bold text-dash-text">
          {loading ? (
            <span className="inline-block h-8 w-48 animate-pulse rounded bg-dash-surface-subtle" />
          ) : (
            <>Welcome back, {userName}</>
          )}
        </h1>
        <p className="mt-1 text-dash-muted">Here&apos;s an overview of your membership</p>
      </div>

      {/* 2x2 grid on phone keeps all four KPIs in a single thumb-zone
          frame; expands to 4-up on lg. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
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
              iconBg="bg-[hsl(var(--dash-ring)/0.1)]"
              iconColor="text-[hsl(var(--dash-ring))]"
            />
            <StatCard
              icon={Wallet}
              label="Outstanding Giving"
              value={`£${(data?.outstandingGiving ?? 0).toFixed(2)}`}
              subtext={data?.outstandingGiving ? "Payment due" : "All clear"}
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

      {!loading && <NextServiceCard nextEvent={data?.nextEvent ?? null} />}

      {/* Quick actions: 2-up tile grid on phone (compact, thumb-friendly),
          becomes a 4-up row at lg. Tiles are vertical (icon top, label
          below) on phone so two fit per row without the description text
          forcing a tall card. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <Link
          href="/member/events"
          className="group flex flex-col gap-2 rounded-2xl border border-dash-border bg-dash-surface p-4 shadow-[var(--dash-shadow)] transition-all hover:border-dash-border-strong hover:shadow-[var(--dash-shadow-raised)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--dash-ring)/0.1)] transition-colors group-hover:bg-[hsl(var(--dash-ring)/0.16)] sm:h-12 sm:w-12">
            <Calendar className="h-5 w-5 text-[hsl(var(--dash-ring))] sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dash-text">RSVP to event</p>
            <p className="hidden text-xs text-dash-muted sm:block">View upcoming events</p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-dash-faint transition-colors group-hover:text-[hsl(var(--dash-ring))] sm:block" />
        </Link>

        <Link
          href="/member/giving"
          className="group flex flex-col gap-2 rounded-2xl border border-dash-border bg-dash-surface p-4 shadow-[var(--dash-shadow)] transition-all hover:border-amber-200 hover:shadow-[var(--dash-shadow-raised)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 transition-colors group-hover:bg-amber-100 sm:h-12 sm:w-12">
            <Wallet className="h-5 w-5 text-amber-600 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dash-text">Pay giving</p>
            <p className="hidden text-xs text-dash-muted sm:block">View and pay outstanding giving</p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-dash-faint transition-colors group-hover:text-amber-500 sm:block" />
        </Link>

        <Link
          href="/member/donations"
          className="group flex flex-col gap-2 rounded-2xl border border-dash-border bg-dash-surface p-4 shadow-[var(--dash-shadow)] transition-all hover:border-pink-200 hover:shadow-[var(--dash-shadow-raised)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-50 transition-colors group-hover:bg-pink-100 sm:h-12 sm:w-12">
            <Heart className="h-5 w-5 text-pink-600 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dash-text">Make donation</p>
            <p className="hidden text-xs text-dash-muted sm:block">Support the mosque</p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-dash-faint transition-colors group-hover:text-pink-500 sm:block" />
        </Link>

        <Link
          href="/member/card"
          className="group flex flex-col gap-2 rounded-2xl border border-dash-border bg-dash-surface p-4 shadow-[var(--dash-shadow)] transition-all hover:border-emerald-200 hover:shadow-[var(--dash-shadow-raised)] sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 transition-colors group-hover:bg-emerald-100 sm:h-12 sm:w-12">
            <IdCard className="h-5 w-5 text-emerald-600 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dash-text">My card</p>
            <p className="hidden text-xs text-dash-muted sm:block">QR + calendar feed</p>
          </div>
          <ArrowRight className="hidden h-4 w-4 text-dash-faint transition-colors group-hover:text-emerald-500 sm:block" />
        </Link>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="admin-surface">
            <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
              <h2 className="text-base font-semibold text-dash-text">Notice</h2>
              <FileText className="h-4 w-4 text-dash-faint" />
            </div>
            <div className="divide-y divide-dash-border">
              {data?.noticeLinks.length ? (
                data.noticeLinks.map((notice) => (
                  <Link
                    key={notice.id}
                    href={`/member/events/${notice.eventId}/notice`}
                    className="block px-6 py-4 transition-colors hover:bg-dash-surface-subtle"
                  >
                    <p className="text-sm font-medium text-dash-text">{notice.title}</p>
                    <p className="mt-1 text-xs text-dash-muted">
                      {notice.eventDate
                        ? new Date(notice.eventDate).toLocaleDateString("en-GB")
                        : "Date to be confirmed"}
                    </p>
                    <p className="mt-1 text-xs text-dash-faint">
                      Viewed {notice.accessCount} time{notice.accessCount === 1 ? "" : "s"}
                    </p>
                  </Link>
                ))
              ) : (
                <div className="px-6 py-8 text-sm text-dash-muted">
                  Notice sent by email will appear here after you sign up.
                </div>
              )}
            </div>
          </div>

          <div className="admin-surface">
            <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
              <h2 className="text-base font-semibold text-dash-text">RSVP History</h2>
              <Calendar className="h-4 w-4 text-dash-faint" />
            </div>
            <div className="divide-y divide-dash-border">
              {data?.rsvps.length ? (
                data.rsvps.slice(0, 5).map((rsvp) => (
                  <div key={rsvp.id} className="px-6 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-dash-text">{rsvp.eventTitle}</p>
                        <p className="mt-1 text-xs text-dash-muted">
                          {rsvp.status} · {rsvp.attendingDining ? "Dining" : "No dining"}
                          {rsvp.guests > 0 ? ` · ${rsvp.guests} guest${rsvp.guests === 1 ? "" : "s"}` : ""}
                        </p>
                      </div>
                      {rsvp.paymentRequired && (
                        <span className="rounded-full bg-dash-surface-subtle px-2 py-0.5 text-[10px] font-medium text-dash-muted">
                          {rsvp.paymentCompleted ? "Paid" : "Unpaid"}
                        </span>
                      )}
                    </div>
                    {rsvp.dietary && (
                      <p className="mt-2 text-xs text-dash-faint">Dietary: {rsvp.dietary}</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-sm text-dash-muted">
                  Your RSVP history will appear here.
                </div>
              )}
            </div>
          </div>

          <div className="admin-surface">
            <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
              <h2 className="text-base font-semibold text-dash-text">Profile Snapshot</h2>
              <User className="h-4 w-4 text-dash-faint" />
            </div>
            <div className="space-y-4 px-6 py-5 text-sm">
              <div>
                <p className="text-xs text-dash-faint">Email</p>
                <p className="font-medium text-dash-text">{data?.user?.email ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs text-dash-faint">Phone</p>
                <p className="font-medium text-dash-text">{data?.user?.phone ?? "Not recorded"}</p>
              </div>
              <div>
                <p className="text-xs text-dash-faint">Dietary preferences</p>
                <p className="font-medium text-dash-text">
                  {data?.user?.dietary_requirements ?? "Not recorded"}
                </p>
              </div>
              <Link
                href="/member/profile"
                className="inline-flex text-sm font-medium text-brand transition-colors hover:text-brand-dark"
              >
                Update profile
              </Link>
            </div>
          </div>
        </div>
      )}

      {!loading && data?.notices.length ? (
        <div className="rounded-2xl border border-[hsl(var(--dash-ring)/0.25)] bg-[hsl(var(--dash-ring)/0.06)] px-6 py-5">
          <h2 className="text-base font-semibold text-[hsl(var(--dash-ring-dark))]">Mosque Notices</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.notices.map((notice) => (
              <div key={notice.id} className="rounded-xl bg-dash-surface/90 p-4 shadow-[var(--dash-shadow)]">
                <p className="text-sm font-medium text-[hsl(var(--dash-ring-dark))]">{notice.title}</p>
                <p className="mt-1 text-xs text-[hsl(var(--dash-ring))]">
                  {new Date(notice.date).toLocaleDateString("en-GB")}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-dash-text">{notice.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="admin-surface">
        <div className="flex items-center justify-between border-b border-dash-border px-6 py-4">
          <h2 className="text-base font-semibold text-dash-text">Recent Activity</h2>
          <TrendingUp className="h-4 w-4 text-dash-faint" />
        </div>
        <div className="divide-y divide-dash-border">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 rounded-lg bg-dash-surface-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-dash-surface-subtle" />
                  <div className="h-3 w-24 rounded bg-dash-surface-subtle" />
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-dash-text">{activity.description}</p>
                    <p className="mt-0.5 text-xs text-dash-faint">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {activity.date}
                    </p>
                  </div>
                  {activity.amount != null && (
                    <p className="text-sm font-medium text-dash-text">
                      £{activity.amount.toFixed(2)}
                    </p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-dash-surface-subtle">
                <CheckCircle2 className="h-6 w-6 text-dash-faint" />
              </div>
              <p className="text-sm font-medium text-dash-muted">No recent activity</p>
              <p className="mt-1 text-xs text-dash-faint">Your activity will appear here</p>
            </div>
          )}
        </div>
      </div>

      {!loading && data?.outstandingGiving != null && data.outstandingGiving > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900">
              You have outstanding giving of £{data.outstandingGiving.toFixed(2)}
            </p>
            <p className="mt-0.5 text-xs text-amber-700">
              Please pay at your earliest convenience.
            </p>
          </div>
          <Link href="/member/giving">
            <button className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700">
              Pay Now
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}
