import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import {
  buildSecretaryReport,
  buildTreasurerReport,
  buildCharityReport,
  buildRecruitmentReport,
  buildOperatorReport,
  buildAnnualReturn,
  isSuccessfulPaymentStatus,
} from "@/lib/reports";
import { ReportsClient } from "./reports-client";
import type { Rsvp, ServiceNoticeSend } from "@/lib/db/types";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Reports</h1>
        <p className="admin-page-copy">
          Reports are only available when connected to the database.
        </p>
      </div>
    );
  }
  const mosqueId = ctx.mosqueId;

  const [
    members,
    newcomers,
    events,
    payments,
    memberGiving,
    donations,
    giftAid,
    campaigns,
    serviceCollections,
  ] = await Promise.all([
    db.getMembers(mosqueId),
    db.getNewcomers(mosqueId),
    db.getEvents(mosqueId),
    db.getPayments(mosqueId),
    db.getMemberGiving(mosqueId),
    db.getDonations(mosqueId),
    db.getGiftAidDeclarations(mosqueId),
    db.getCharityCampaigns(mosqueId),
    db.getServiceCollections(mosqueId).catch(() => []),
  ]);

  const rsvpsByEvent = new Map<string, Rsvp[]>();
  const noticeSendsByEvent = new Map<string, ServiceNoticeSend[]>();
  const hasNoticeByEvent = new Set<string>();
  await Promise.all(
    events.map(async (e) => {
      const [rsvps, notice, sends] = await Promise.all([
        db.getRsvpsByEventId(e.id, mosqueId),
        db.getServiceNotice(e.id, mosqueId),
        db.listServiceNoticeSends(mosqueId, e.id, 200),
      ]);
      rsvpsByEvent.set(e.id, rsvps);
      noticeSendsByEvent.set(e.id, sends);
      if (notice) hasNoticeByEvent.add(e.id);
    })
  );

  const secretary = buildSecretaryReport({
    events,
    rsvpsByEvent,
    members,
    noticeSendsByEvent,
    hasNoticeByEvent,
  });
  const treasurer = buildTreasurerReport({ payments, memberGiving });
  const charity = buildCharityReport({
    campaigns,
    donations,
    giftAid,
    events,
    serviceCollections,
  });
  const recruitment = buildRecruitmentReport({ newcomers });
  const annualReturn = buildAnnualReturn({ members });

  let operator: ReturnType<typeof buildOperatorReport> | null = null;
  if (isSupabaseConfigured()) {
    try {
      const mosques = await db.listMosques();
      const membersByMosque = new Map<string, number>();
      const upcomingByMosque = new Map<string, number>();
      const paymentsLast30ByMosque = new Map<string, number>();
      const since = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
      await Promise.all(
        mosques.map(async (l) => {
          const [m, e, p] = await Promise.all([
            db.getMembers(l.id),
            db.getEvents(l.id, { upcoming: true }),
            db.getPayments(l.id),
          ]);
          membersByMosque.set(l.id, m.length);
          upcomingByMosque.set(l.id, e.length);
          paymentsLast30ByMosque.set(
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
        mosques,
        membersByMosque,
        upcomingByMosque,
        paymentsLast30ByMosque,
      });
    } catch (e) {
      console.error("Operator report failed", e);
    }
  }

  return (
    <ReportsClient
      mosqueName={ctx.mosqueSlug}
      secretary={JSON.parse(JSON.stringify(secretary))}
      treasurer={JSON.parse(JSON.stringify(treasurer))}
      charity={JSON.parse(JSON.stringify(charity))}
      recruitment={JSON.parse(JSON.stringify(recruitment))}
      annualReturn={JSON.parse(JSON.stringify(annualReturn))}
      operator={operator ? JSON.parse(JSON.stringify(operator)) : null}
    />
  );
}
