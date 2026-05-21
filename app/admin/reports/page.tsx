import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  buildSecretaryReport,
  buildTreasurerReport,
  buildCharityReport,
  buildRecruitmentReport,
  buildOperatorReport,
  isSuccessfulPaymentStatus,
} from "@/lib/reports";
import { ReportsClient } from "./reports-client";
import type { Rsvp, EventSummonsSend } from "@/lib/db/types";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Reports</h1>
        <p className="admin-page-copy">
          Reports are only available when connected to the database.
        </p>
      </div>
    );
  }
  const lodgeId = ctx.lodgeId;

  const [
    members,
    leads,
    events,
    payments,
    memberDues,
    donations,
    giftAid,
    campaigns,
    meetingCollections,
  ] = await Promise.all([
    db.getMembers(lodgeId),
    db.getLeads(lodgeId),
    db.getEvents(lodgeId),
    db.getPayments(lodgeId),
    db.getMemberDues(lodgeId),
    db.getDonations(lodgeId),
    db.getGiftAidDeclarations(lodgeId),
    db.getCharityCampaigns(lodgeId),
    db.getMeetingCollections(lodgeId).catch(() => []),
  ]);

  const rsvpsByEvent = new Map<string, Rsvp[]>();
  const summonsSendsByEvent = new Map<string, EventSummonsSend[]>();
  const hasSummonsByEvent = new Set<string>();
  await Promise.all(
    events.map(async (e) => {
      const [rsvps, summons, sends] = await Promise.all([
        db.getRsvpsByEventId(e.id, lodgeId),
        db.getEventSummons(e.id, lodgeId),
        db.listEventSummonsSends(lodgeId, e.id, 200),
      ]);
      rsvpsByEvent.set(e.id, rsvps);
      summonsSendsByEvent.set(e.id, sends);
      if (summons) hasSummonsByEvent.add(e.id);
    })
  );

  const secretary = buildSecretaryReport({
    events,
    rsvpsByEvent,
    members,
    summonsSendsByEvent,
    hasSummonsByEvent,
  });
  const treasurer = buildTreasurerReport({ payments, memberDues });
  const charity = buildCharityReport({
    campaigns,
    donations,
    giftAid,
    events,
    meetingCollections,
  });
  const recruitment = buildRecruitmentReport({ leads });

  let operator: ReturnType<typeof buildOperatorReport> | null = null;
  if (isSupabaseConfigured()) {
    try {
      const lodges = await db.listLodges();
      const membersByLodge = new Map<string, number>();
      const upcomingByLodge = new Map<string, number>();
      const paymentsLast30ByLodge = new Map<string, number>();
      const since = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
      await Promise.all(
        lodges.map(async (l) => {
          const [m, e, p] = await Promise.all([
            db.getMembers(l.id),
            db.getEvents(l.id, { upcoming: true }),
            db.getPayments(l.id),
          ]);
          membersByLodge.set(l.id, m.length);
          upcomingByLodge.set(l.id, e.length);
          paymentsLast30ByLodge.set(
            l.id,
            p
              .filter(
                (pp) =>
                  isSuccessfulPaymentStatus(pp.status) &&
                  pp.completed_at &&
                  new Date(pp.completed_at).getTime() >= since
              )
              .reduce((s, pp) => s + pp.total_amount, 0)
          );
        })
      );
      operator = buildOperatorReport({
        lodges,
        membersByLodge,
        upcomingByLodge,
        paymentsLast30ByLodge,
      });
    } catch (e) {
      console.error("Operator report failed", e);
    }
  }

  return (
    <ReportsClient
      lodgeName={ctx.lodgeSlug}
      secretary={JSON.parse(JSON.stringify(secretary))}
      treasurer={JSON.parse(JSON.stringify(treasurer))}
      charity={JSON.parse(JSON.stringify(charity))}
      recruitment={JSON.parse(JSON.stringify(recruitment))}
      operator={operator ? JSON.parse(JSON.stringify(operator)) : null}
    />
  );
}
