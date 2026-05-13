import { notFound } from "next/navigation";
import { getAdminReadContext } from "@/lib/admin/read-context";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { defaultAgendaItems, renderDefaultSummonsOpening } from "@/lib/summons/defaults";
import { SummonsEditorClient } from "./summons-editor-client";

export default async function EditMeetingSummonsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const event = useMock
    ? mockDb.getEventById(id)
    : lodgeId
      ? await db.getEventById(id, lodgeId)
      : null;
  if (!event) notFound();

  const [summons, sends, lodge] =
    !useMock && lodgeId
      ? await Promise.all([
          db.getEventSummons(id, lodgeId),
          db.listEventSummonsSends(lodgeId, id),
          db.getLodgeById(lodgeId),
        ])
      : [null, [], useMock ? mockDb.listLodges()[0] ?? null : null];
  const defaultOpeningText = renderDefaultSummonsOpening(event, lodge);

  const summonsStatus = (event.summons_status ?? "none") as
    | "none"
    | "draft"
    | "approved"
    | "sent";

  return (
    <SummonsEditorClient
      eventId={id}
      eventTitle={event.title}
      sendHistory={JSON.parse(JSON.stringify(sends))}
      summonsStatus={summonsStatus}
      approvedAt={event.summons_approved_at ?? null}
      approvedByEmail={event.summons_approved_by_email ?? null}
      initial={{
        issue_date:
          summons?.issue_date ??
          new Date().toISOString().slice(0, 10),
        opening_text: summons?.opening_text ?? defaultOpeningText,
        agenda_items: summons?.agenda_items?.length
          ? summons.agenda_items
          : defaultAgendaItems(),
        menu_items: summons?.menu_items ?? [],
        dining_time: summons?.dining_time ?? "",
        notices: summons?.notices ?? [],
        include_member_directory: summons?.include_member_directory ?? true,
      }}
    />
  );
}
