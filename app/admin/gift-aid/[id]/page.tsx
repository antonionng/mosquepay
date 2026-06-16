import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { notFound, redirect } from "next/navigation";
import { GiftAidDetailClient } from "./gift-aid-detail-client";

export const dynamic = "force-dynamic";

export default async function GiftAidDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.mosqueId) {
    redirect("/admin/gift-aid");
  }
  const mosqueId = ctx.mosqueId;

  const declaration = await db.getGiftAidDeclarationById(id, mosqueId);
  if (!declaration) notFound();

  const [donations, auditLogs] = await Promise.all([
    db.getDonationsByGiftAidDeclaration(id, mosqueId),
    db.listAuditLogsByEntity(mosqueId, "gift_aid_declaration", id),
  ]);

  return (
    <GiftAidDetailClient
      declaration={JSON.parse(JSON.stringify(declaration))}
      donations={JSON.parse(JSON.stringify(donations))}
      auditLogs={JSON.parse(JSON.stringify(auditLogs))}
    />
  );
}
