"use client";

import { useEffect, useState } from "react";
import {
  Heart,
  CheckCircle2,
  Clock,
  Gift,
  PoundSterling,
  TrendingUp,
  FileCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Donation {
  id: string;
  date: string;
  amount: number;
  fund?: string;
  giftAid: boolean;
}

interface DonationData {
  totalThisYear: number;
  giftAidDeclared: boolean;
  donations: Donation[];
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
      <div className="h-5 w-32 rounded bg-slate-100 mb-3" />
      <div className="h-8 w-24 rounded bg-slate-100 mb-2" />
      <div className="h-4 w-40 rounded bg-slate-100" />
    </div>
  );
}

export default function MemberDonationsPage() {
  const [data, setData] = useState<DonationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/member/dashboard");
        if (res.ok) {
          const d = await res.json();
          setData(
            d.donationData ?? {
              totalThisYear: d.donationTotal ?? 0,
              giftAidDeclared: false,
              donations: [],
            }
          );
        }
      } catch {
        setData({ totalThisYear: 0, giftAidDeclared: false, donations: [] });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Donations</h1>
          <p className="text-slate-500 mt-1">Your charitable contributions</p>
        </div>
        <Button variant="primary">
          <Heart className="h-4 w-4 mr-2" />
          Make a Donation
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50">
                  <PoundSterling className="h-4 w-4 text-pink-600" />
                </div>
                <h3 className="text-sm font-medium text-slate-500">Total This Year</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                £{(data?.totalThisYear ?? 0).toFixed(2)}
              </p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {new Date().getFullYear()} contributions
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                  <Gift className="h-4 w-4 text-emerald-600" />
                </div>
                <h3 className="text-sm font-medium text-slate-500">Donations Made</h3>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {data?.donations.length ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                total contributions
              </p>
            </div>

            <div
              className={`rounded-2xl border p-6 shadow-sm ${
                data?.giftAidDeclared
                  ? "border-emerald-200 bg-emerald-50/50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    data?.giftAidDeclared ? "bg-emerald-100" : "bg-slate-100"
                  }`}
                >
                  <FileCheck
                    className={`h-4 w-4 ${
                      data?.giftAidDeclared ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                </div>
                <h3 className="text-sm font-medium text-slate-500">Gift Aid</h3>
              </div>
              {data?.giftAidDeclared ? (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-base font-semibold text-emerald-900">Active</p>
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    Your donations are boosted by 25%
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-700">Not declared</p>
                  <p className="text-xs text-slate-400 mt-1">
                    <button className="text-blue-600 hover:text-blue-700 font-medium">
                      Set up Gift Aid
                    </button>{" "}
                    to boost donations by 25%
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Donation History</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data?.donations && data.donations.length > 0 ? (
                data.donations.map((d) => (
                  <div key={d.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50">
                      <Heart className="h-4 w-4 text-pink-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {d.fund ?? "General Fund"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(d.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {d.giftAid && (
                        <Badge variant="success">
                          <Gift className="h-3 w-3 mr-1" />
                          Gift Aid
                        </Badge>
                      )}
                      <p className="text-sm font-semibold text-slate-900">
                        £{d.amount.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 mb-3">
                    <Heart className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No donations yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Make your first donation to support the lodge
                  </p>
                  <Button variant="primary" size="sm" className="mt-4">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Donate Now
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
