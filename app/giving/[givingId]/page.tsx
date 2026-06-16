import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PublicGivingPayClient } from "./giving-pay-client";

export default async function PublicGivingPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ givingId: string }>;
  searchParams: Promise<{ email?: string; mosque?: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const { givingId } = await params;
  const { email, mosque } = await searchParams;
  if (!email) notFound();

  const mosqueSlug = mosque ?? "central-jamia-demo";
  const mosqueId = await db.resolveMosqueId(mosqueSlug);
  if (!mosqueId) notFound();

  const [mosqueProfile, givingRecords, mosqueGiving] = await Promise.all([
    db.getMosqueById(mosqueId),
    db.getMemberGiving(mosqueId, { memberEmail: email }),
    db.getMosqueGiving(mosqueId),
  ]);
  const giving = givingRecords.find((record) => record.id === givingId);
  if (!giving) notFound();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          Mosque Giving
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Pay {mosqueProfile?.name ?? "mosque"} giving
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This payment link is for {giving.member_name ?? email}. No portal account is required.
        </p>

        <div className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-semibold text-slate-950">£{giving.amount.toFixed(2)}</dd>
            </div>
            {giving.charitable_amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Gift Aid eligible portion</dt>
                <dd className="font-semibold text-emerald-700">
                  £{giving.charitable_amount.toFixed(2)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Period</dt>
              <dd className="text-right font-medium text-slate-950">
                {formatDate(giving.period_start)} to {formatDate(giving.period_end)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize text-slate-950">{giving.status}</dd>
            </div>
          </dl>
        </div>

        {giving.status === "paid" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            These giving are already marked as paid.
          </div>
        ) : (
          <PublicGivingPayClient
            givingId={giving.id}
            memberEmail={email}
            memberName={giving.member_name}
            allowInstalments={mosqueGiving[0]?.allow_instalments === true}
          />
        )}
      </div>
    </main>
  );
}
