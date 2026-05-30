import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminMembersClient } from "./members-client";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const members = useMock
    ? mockDb.getMembers()
    : lodgeId
      ? await db.getMembers(lodgeId)
      : [];

  const offices = lodgeId ? await db.listOfficerLadder(lodgeId) : [];

  // Drive the "missing Gift Aid" / "has declaration" quick filters.
  // One query for the lodge's declarations, then we build a member-side
  // lookup from member_id + lowercased email so we hit both linkage
  // paths (member_id is the primary, email is the historical fallback
  // for pre-link rows). Cheap relative to looping per-member.
  let giftAidDeclaredIds: string[] = [];
  if (lodgeId) {
    try {
      const declarations = await db.getGiftAidDeclarations(lodgeId);
      const activeByMember = new Map<string, true>();
      const activeByEmail = new Map<string, true>();
      for (const d of declarations) {
        if (d.revoked_at || !d.declaration_confirmed) continue;
        if (d.member_id) activeByMember.set(d.member_id, true);
        if (d.donor_email) {
          activeByEmail.set(d.donor_email.toLowerCase(), true);
        }
      }
      giftAidDeclaredIds = members
        .filter(
          (m) =>
            activeByMember.has(m.id) ||
            activeByEmail.has(m.email.toLowerCase()),
        )
        .map((m) => m.id);
    } catch {
      /* non-fatal: the filter will just show 0 declared */
    }
  }

  return (
    <AdminMembersClient
      members={JSON.parse(JSON.stringify(members))}
      offices={JSON.parse(JSON.stringify(offices))}
      giftAidDeclaredMemberIds={giftAidDeclaredIds}
    />
  );
}
