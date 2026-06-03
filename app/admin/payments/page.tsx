import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminPaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const payments = useMock
    ? mockDb.getPayments()
    : lodgeId
      ? await db.getPayments(lodgeId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : lodgeId
      ? await db.getDonations(lodgeId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : lodgeId
      ? await db.getGiftAidDeclarations(lodgeId)
      : [];
  const duesRecords = useMock
    ? []
    : lodgeId
      ? await db.getMemberDues(lodgeId)
      : [];

  // Meetings list for the inline "associate to meeting" picker on each
  // payment row. Slimmed to what the dropdown needs.
  const events = useMock
    ? []
    : lodgeId
      ? await db.getEvents(lodgeId)
      : [];
  const eventOptions = events
    .map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  return (
    <AdminPaymentsClient
      payments={JSON.parse(JSON.stringify(payments))}
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      duesRecords={JSON.parse(JSON.stringify(duesRecords))}
      events={JSON.parse(JSON.stringify(eventOptions))}
    />
  );
}
