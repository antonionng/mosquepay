import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { notFound, redirect } from "next/navigation";
import { CaseDetailClient } from "./case-detail-client";

export const dynamic = "force-dynamic";

export default async function PastoralCareCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    redirect("/admin/pastoral_care");
  }
  const mosqueId = ctx.mosqueId;

  const pastoralCase = await db.getPastoralCareCaseById(id, mosqueId);
  if (!pastoralCase) notFound();

  const [visits, member, auditLogs, alerts] = await Promise.all([
    db.listPastoralCareVisits(id, mosqueId),
    pastoralCase.member_id
      ? db.getMemberById(pastoralCase.member_id, mosqueId)
      : Promise.resolve(null),
    db.listAuditLogsByEntity(mosqueId, "pastoral_case", id),
    db.listPastoralCareAlerts(mosqueId, { status: "open" }),
  ]);

  const relatedAlerts = alerts.filter(
    (a) => a.case_id === id || a.member_id === pastoralCase.member_id
  );

  return (
    <CaseDetailClient
      pastoralCase={JSON.parse(JSON.stringify(pastoralCase))}
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
