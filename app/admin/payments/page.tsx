import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminPaymentsClient } from "./payments-client";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;

  const payments = useMock
    ? mockDb.getPayments()
    : churchId
      ? await db.getPayments(churchId)
      : [];
  const donations = useMock
    ? mockDb.getDonations()
    : churchId
      ? await db.getDonations(churchId)
      : [];
  const giftAidDeclarations = useMock
    ? mockDb.getGiftAidDeclarations()
    : churchId
      ? await db.getGiftAidDeclarations(churchId)
      : [];
  const givingRecords = useMock
    ? []
    : churchId
      ? await db.getMemberGiving(churchId)
      : [];

  // Services list for the inline "associate to service" picker on each
  // payment row. Slimmed to what the dropdown needs.
  const events = useMock
    ? []
    : churchId
      ? await db.getEvents(churchId)
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
