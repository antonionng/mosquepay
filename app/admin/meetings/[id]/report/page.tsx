import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { isConfirmedRsvp } from "@/lib/meetings/attendance";
import {
  reconcileMeeting,
  METHOD_GROUP_LABEL,
  CATEGORY_LABEL,
  type CategoryKey,
  type PaymentMethodGroup,
} from "@/lib/meetings/reconcile";
import { ReportActions } from "./report-actions";

export const dynamic = "force-dynamic";

function money(n: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(n || 0);
}

function longDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function MeetingReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const countedRaw = Array.isArray(sp.counted) ? sp.counted[0] : sp.counted;
  const stripRaw = Array.isArray(sp.strip) ? sp.strip[0] : sp.strip;
  const cashCounted =
    countedRaw != null && countedRaw !== "" ? Number(countedRaw) : null;
  const rafflePrice = stripRaw ? Number(stripRaw) || 5 : 5;

  const ctx = await getAdminReadContext();
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  if (!lodgeId) notFound();

  const event = await db.getEventById(id, lodgeId);
  if (!event) notFound();

  const [rsvps, guests, payments, donations, lodge, collections] =
    await Promise.all([
      db.getRsvpsByEventId(id, lodgeId).catch(() => []),
      db.getGuestsByEvent(id, lodgeId).catch(() => []),
      db.getPaymentsByEventId(id, lodgeId).catch(() => []),
      db.getDonationsByEvent(id, lodgeId).catch(() => []),
      db.getLodgeById(lodgeId).catch(() => null),
      db.getMeetingCollections(lodgeId, { eventId: id }).catch(() => []),
    ]);

  const collection = collections[0] ?? null;
  const currency = "GBP";
  const recon = reconcileMeeting(payments, { rafflePrice });

  const confirmed = rsvps.filter(isConfirmedRsvp);
  const ceremonyCount = confirmed.filter((r) => r.attending_ceremony).length;
  const diningCount = confirmed.filter((r) => r.attending_dining).length;
  const guestCount = confirmed.reduce((s, r) => s + (r.number_of_guests ?? 0), 0);
  const apologies = rsvps.filter(
    (r) => !r.attending_ceremony && r.status !== "cancelled",
  ).length;
  const wineBottles = rsvps.reduce(
    (s, r) => s + (r.raffle_wine_pledged ? r.raffle_wine_bottles ?? 0 : 0),
    0,
  );

  const donorLinked = donations.filter(
    (d) => typeof d.donor_email === "string" && d.donor_email.trim().length > 0,
  );
  const donorLinkedTotal = donorLinked.reduce(
    (s, d) => s + Number(d.amount ?? 0),
    0,
  );
  const giftAidReclaimable = collection
    ? Number(collection.gift_aid_reclaimable_amount ?? 0)
    : recon.charityTotal * 0.25;
  const gasdsEligible = collection
    ? Number(collection.gasds_eligible_amount ?? 0)
    : 0;

  const methodOrder: PaymentMethodGroup[] = ["cash", "lodgepay", "other"];
  const categoryOrder: CategoryKey[] = [
    "meeting_fee",
    "dining",
    "guest_ticket",
    "charity",
    "raffle",
    "general",
  ];

  const cashVariance =
    cashCounted != null ? cashCounted - recon.byMethod.cash.amount : null;

  const closedAt =
    "meeting_closed_at" in event
      ? (event as { meeting_closed_at: string | null }).meeting_closed_at
      : null;

  return (
    <div className="mx-auto max-w-[820px] px-4 py-6 text-slate-900 print:px-0 print:py-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="mb-5 flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">Meeting treasurer&rsquo;s report</p>
        <ReportActions backHref={`/admin/meetings/${id}`} />
      </div>

      <div className="report-sheet rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Header */}
        <header className="border-b-2 border-slate-900 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {lodge?.name ?? "Lodge"}
                {lodge?.lodge_number ? ` No. ${lodge.lodge_number}` : ""}
              </h1>
              <p className="mt-1 text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Meeting Treasurer&rsquo;s Report
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p>Generated {longDate(new Date().toISOString())}</p>
              {closedAt ? (
                <p className="mt-1 font-medium text-emerald-700">
                  Meeting closed {longDate(closedAt)}
                </p>
              ) : (
                <p className="mt-1 font-medium text-amber-700">Not yet closed</p>
              )}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-semibold">{event.title}</p>
            <p className="text-sm text-slate-600">
              {longDate(event.event_date)}
              {event.event_time ? ` · ${event.event_time}` : ""}
              {event.location ? ` · ${event.location}` : ""}
            </p>
          </div>
        </header>

        {/* Attendance */}
        <Section title="Attendance & dining">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="At ceremony" value={String(ceremonyCount)} />
            <Stat label="Dining covers" value={String(diningCount)} />
            <Stat label="Guests" value={String(guestCount)} />
            <Stat label="Apologies" value={String(apologies)} />
          </div>
          {wineBottles > 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Wine raffle pledges: {wineBottles} bottle
              {wineBottles === 1 ? "" : "s"}
            </p>
          ) : null}
        </Section>

        {/* Money in by method */}
        <Section title="Money collected — by method">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1.5">Method</th>
                <th className="py-1.5 text-right">Payments</th>
                <th className="py-1.5 text-right">Amount</th>
                <th className="py-1.5 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {methodOrder.map((m) => {
                const t = recon.byMethod[m];
                if (t.amount === 0 && t.count === 0) return null;
                const pct =
                  recon.collectedTotal > 0
                    ? Math.round((t.amount / recon.collectedTotal) * 100)
                    : 0;
                return (
                  <tr key={m} className="border-b border-slate-100">
                    <td className="py-1.5">{METHOD_GROUP_LABEL[m]}</td>
                    <td className="py-1.5 text-right tabular-nums">{t.count}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {money(t.amount, currency)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{pct}%</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-900 font-semibold">
                <td className="py-1.5">Total collected</td>
                <td className="py-1.5 text-right tabular-nums">
                  {recon.collectedCount}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {money(recon.collectedTotal, currency)}
                </td>
                <td className="py-1.5 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
          {(recon.pendingTotal > 0 || recon.refundedTotal > 0) && (
            <p className="mt-2 text-xs text-slate-500">
              {recon.pendingTotal > 0
                ? `${money(recon.pendingTotal, currency)} pending (${recon.pendingCount} unsettled) — not counted above. `
                : ""}
              {recon.refundedTotal > 0
                ? `${money(recon.refundedTotal, currency)} refunded/reversed (${recon.refundedCount}) — excluded.`
                : ""}
            </p>
          )}
        </Section>

        {/* Cash reconciliation */}
        <Section title="Cash reconciliation (count the tin)">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Recorded cash" value={money(recon.byMethod.cash.amount, currency)} />
            <Stat
              label="Counted cash"
              value={cashCounted != null ? money(cashCounted, currency) : "—"}
            />
            <Stat
              label="Variance"
              value={cashVariance != null ? money(cashVariance, currency) : "—"}
              accent={
                cashVariance == null
                  ? "muted"
                  : Math.abs(cashVariance) < 0.005
                    ? "good"
                    : "bad"
              }
            />
          </div>
          {cashCounted == null ? (
            <p className="mt-2 text-xs text-slate-500">
              Enter the counted cash on the meeting page to record a variance
              here.
            </p>
          ) : null}
        </Section>

        {/* Money in by category */}
        <Section title="Money collected — by category">
          <table className="w-full text-sm">
            <tbody>
              {categoryOrder.map((c) => {
                const amount = recon.byCategory[c];
                if (amount === 0) return null;
                return (
                  <tr key={c} className="border-b border-slate-100">
                    <td className="py-1.5">
                      {CATEGORY_LABEL[c]}
                      {c === "raffle" && recon.raffleStrips > 0
                        ? ` · ${recon.raffleStrips} strip${recon.raffleStrips === 1 ? "" : "s"} to ${recon.raffleBuyers} ${recon.raffleBuyers === 1 ? "buyer" : "buyers"}`
                        : ""}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {money(amount, currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        {/* Charity & Gift Aid */}
        <Section title="Charity & Gift Aid">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Charity collected" value={money(recon.charityTotal, currency)} />
            <Stat
              label="Donor-linked"
              value={money(donorLinkedTotal, currency)}
              sub={`${donorLinked.length} donor${donorLinked.length === 1 ? "" : "s"}`}
            />
            <Stat label="Gift Aid reclaimable" value={money(giftAidReclaimable, currency)} />
            <Stat label="GASDS eligible" value={money(gasdsEligible, currency)} />
          </div>
          {collection?.gift_aid_claim_batch_id ? (
            <p className="mt-2 text-xs text-slate-500">
              Gift Aid claim batch created at close
              {collection.relief_chest_delivered_at
                ? ` · delivered to Relief Chest ${longDate(collection.relief_chest_delivered_at)}`
                : " · not yet delivered to Relief Chest"}
              .
            </p>
          ) : null}
        </Section>

        {/* Per-payer ledger */}
        <Section title="Payments received">
          {recon.payers.length === 0 ? (
            <p className="text-sm text-slate-500">No payments recorded.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-left uppercase tracking-wide text-slate-500">
                  <th className="py-1.5">Name</th>
                  <th className="py-1.5">Method</th>
                  <th className="py-1.5 text-right">Raffle</th>
                  <th className="py-1.5 text-right">Charity</th>
                  <th className="py-1.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {recon.payers.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1.5">
                      {p.name || p.email || "—"}
                    </td>
                    <td className="py-1.5">{METHOD_GROUP_LABEL[p.method]}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {p.raffleStrips > 0
                        ? `${p.raffleStrips} strip${p.raffleStrips === 1 ? "" : "s"}`
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {p.charity > 0 ? money(p.charity, currency) : "—"}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">
                      {money(p.total, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {collection?.notes || (closedAt && "meeting_close_notes" in event) ? (
          <Section title="Notes">
            <p className="whitespace-pre-wrap text-sm text-slate-700">
              {collection?.notes ??
                (event as { meeting_close_notes?: string | null })
                  .meeting_close_notes ??
                ""}
            </p>
          </Section>
        ) : null}

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-8 print:mt-16">
          <SignatureLine label="Treasurer" />
          <SignatureLine label="Secretary / Verifier" />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "default" | "good" | "bad" | "muted";
}) {
  const valueColor =
    accent === "good"
      ? "text-emerald-700"
      : accent === "bad"
        ? "text-rose-700"
        : accent === "muted"
          ? "text-slate-400"
          : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${valueColor}`}>
        {value}
      </p>
      {sub ? <p className="text-[10px] text-slate-400">{sub}</p> : null}
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-slate-400" />
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}
