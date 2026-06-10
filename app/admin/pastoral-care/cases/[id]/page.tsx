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
  if (ctx.mode !== "database" || !ctx.churchId) {
    redirect("/admin/pastoral_care");
  }
  const churchId = ctx.churchId;

  const pastoralCase = await db.getPastoralCareCaseById(id, churchId);
  if (!pastoralCase) notFound();

  const [visits, member, auditLogs, alerts] = await Promise.all([
    db.listPastoralCareVisits(id, churchId),
    pastoralCase.member_id
      ? db.getMemberById(pastoralCase.member_id, churchId)
      : Promise.resolve(null),
    db.listAuditLogsByEntity(churchId, "pastoral_case", id),
    db.listPastoralCareAlerts(churchId, { status: "open" }),
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
