import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminMembersClient } from "./members-client";

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

  return (
    <AdminMembersClient
      members={JSON.parse(JSON.stringify(members))}
      offices={JSON.parse(JSON.stringify(offices))}
    />
  );
}
