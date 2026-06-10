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
  if (ctx.mode !== "database" || !ctx.churchId) {
    return (
      <div className="space-y-4">
        <h1 className="admin-page-title">Reports</h1>
        <p className="admin-page-copy">
          Reports are only available when connected to the database.
        </p>
      </div>
    );
  }
  const churchId = ctx.churchId;

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
    db.getMembers(churchId),
    db.getNewcomers(churchId),
    db.getEvents(churchId),
    db.getPayments(churchId),
    db.getMemberGiving(churchId),
    db.getDonations(churchId),
    db.getGiftAidDeclarations(churchId),
    db.getCharityCampaigns(churchId),
    db.getServiceCollections(churchId).catch(() => []),
  ]);

  const rsvpsByEvent = new Map<string, Rsvp[]>();
  const noticeSendsByEvent = new Map<string, ServiceNoticeSend[]>();
  const hasNoticeByEvent = new Set<string>();
  await Promise.all(
    events.map(async (e) => {
      const [rsvps, notice, sends] = await Promise.all([
        db.getRsvpsByEventId(e.id, churchId),
        db.getServiceNotice(e.id, churchId),
        db.listServiceNoticeSends(churchId, e.id, 200),
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
      const churches = await db.listChurches();
      const membersByChurch = new Map<string, number>();
      const upcomingByChurch = new Map<string, number>();
      const paymentsLast30ByChurch = new Map<string, number>();
      const since = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
      await Promise.all(
        churches.map(async (l) => {
          const [m, e, p] = await Promise.all([
            db.getMembers(l.id),
            db.getEvents(l.id, { upcoming: true }),
            db.getPayments(l.id),
          ]);
          membersByChurch.set(l.id, m.length);
          upcomingByChurch.set(l.id, e.length);
          paymentsLast30ByChurch.set(
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
        churches,
        membersByChurch,
        upcomingByChurch,
        paymentsLast30ByChurch,
      });
    } catch (e) {
      console.error("Operator report failed", e);
    }
  }

  return (
    <ReportsClient
      churchName={ctx.churchSlug}
      secretary={JSON.parse(JSON.stringify(secretary))}
      treasurer={JSON.parse(JSON.stringify(treasurer))}
      charity={JSON.parse(JSON.stringify(charity))}
      recruitment={JSON.parse(JSON.stringify(recruitment))}
      annualReturn={JSON.parse(JSON.stringify(annualReturn))}
      operator={operator ? JSON.parse(JSON.stringify(operator)) : null}
    />
  );
}
