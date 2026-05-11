import { notFound } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { PublicDuesPayClient } from "./dues-pay-client";

export default async function PublicDuesPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ duesId: string }>;
  searchParams: Promise<{ email?: string; lodge?: string }>;
}) {
  if (!isSupabaseConfigured()) notFound();

  const { duesId } = await params;
  const { email, lodge } = await searchParams;
  if (!email) notFound();

  const lodgeSlug = lodge ?? "covenant-4344";
  const lodgeId = await db.resolveLodgeId(lodgeSlug);
  if (!lodgeId) notFound();

  const [lodgeProfile, duesRecords, lodgeDues] = await Promise.all([
    db.getLodgeById(lodgeId),
    db.getMemberDues(lodgeId, { memberEmail: email }),
    db.getLodgeDues(lodgeId),
  ]);
  const dues = duesRecords.find((record) => record.id === duesId);
  if (!dues) notFound();

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
          Lodge Dues
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Pay {lodgeProfile?.name ?? "lodge"} dues
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          This payment link is for {dues.member_name ?? email}. No portal account is required.
        </p>

        <div className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Amount</dt>
              <dd className="font-semibold text-slate-950">£{dues.amount.toFixed(2)}</dd>
            </div>
            {dues.charitable_amount > 0 ? (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Gift Aid eligible portion</dt>
                <dd className="font-semibold text-emerald-700">
                  £{dues.charitable_amount.toFixed(2)}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Period</dt>
              <dd className="text-right font-medium text-slate-950">
                {formatDate(dues.period_start)} to {formatDate(dues.period_end)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium capitalize text-slate-950">{dues.status}</dd>
            </div>
          </dl>
        </div>

        {dues.status === "paid" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            These dues are already marked as paid.
          </div>
        ) : (
          <PublicDuesPayClient
            duesId={dues.id}
            memberEmail={email}
            memberName={dues.member_name}
            allowInstalments={lodgeDues[0]?.allow_instalments === true}
          />
        )}
      </div>
    </main>
  );
}
