import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { notFound, redirect } from "next/navigation";
import { CaseDetailClient } from "./case-detail-client";

export const dynamic = "force-dynamic";

export default async function WelfareCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.lodgeId) {
    redirect("/admin/almoner");
  }
  const lodgeId = ctx.lodgeId;

  const welfareCase = await db.getWelfareCaseById(id, lodgeId);
  if (!welfareCase) notFound();

  const [visits, member, auditLogs, alerts] = await Promise.all([
    db.listWelfareVisits(id, lodgeId),
    welfareCase.member_id
      ? db.getMemberById(welfareCase.member_id, lodgeId)
      : Promise.resolve(null),
    db.listAuditLogsByEntity(lodgeId, "welfare_case", id),
    db.listWelfareAlerts(lodgeId, { status: "open" }),
  ]);

  const relatedAlerts = alerts.filter(
    (a) => a.case_id === id || a.member_id === welfareCase.member_id
  );

  return (
    <CaseDetailClient
      welfareCase={JSON.parse(JSON.stringify(welfareCase))}
      visits={JSON.parse(JSON.stringify(visits))}
      member={
        member
          ? {
              id: member.id,
              full_name: member.full_name,
              email: member.email,
              phone: member.phone,
            }
          : null
      }
      auditLogs={JSON.parse(JSON.stringify(auditLogs))}
      relatedAlerts={JSON.parse(JSON.stringify(relatedAlerts))}
    />
  );
}
