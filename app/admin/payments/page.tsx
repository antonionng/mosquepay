import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminPaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const payments = useMock
    ? mockDb.getPayments()
    : mosqueId
      ? await db.getPayments(mosqueId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : mosqueId
      ? await db.getDonations(mosqueId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : mosqueId
      ? await db.getGiftAidDeclarations(mosqueId)
      : [];
  const givingRecords = useMock
    ? []
    : mosqueId
      ? await db.getMemberGiving(mosqueId)
      : [];

  // Services list for the inline "associate to service" picker on each
  // payment row. Slimmed to what the dropdown needs.
  const events = useMock
    ? []
    : mosqueId
      ? await db.getEvents(mosqueId)
      : [];
  const eventOptions = events
    .map((e) => ({ id: e.id, title: e.title, event_date: e.event_date }))
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  return (
    <AdminPaymentsClient
      payments={JSON.parse(JSON.stringify(payments))}
      donations={JSON.parse(JSON.stringify(donations))}
      giftAidDeclarations={JSON.parse(JSON.stringify(giftAidDeclarations))}
      givingRecords={JSON.parse(JSON.stringify(givingRecords))}
      events={JSON.parse(JSON.stringify(eventOptions))}
    />
  );
}
