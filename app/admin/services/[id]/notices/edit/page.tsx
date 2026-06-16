import { notFound } from "next/navigation";
import { getAdminReadContext } from "@/lib/admin/read-context";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { defaultAgendaItems, renderDefaultNoticeOpening } from "@/lib/notices/defaults";
import { NoticeEditorClient } from "./notice-editor-client";

function newcomerContactsFromNotice(
  notice: Awaited<ReturnType<typeof db.getServiceNotice>> | null
) {
  if (notice?.newcomer_contacts?.length) {
    return notice.newcomer_contacts.map((officer) => ({
      name: officer.name ?? "",
      email: officer.email ?? "",
      phone: officer.phone ?? "",
    }));
  }

  if (notice?.newcomer_contact_name) {
    return [
      {
        name: notice.newcomer_contact_name,
        email: notice.newcomer_contact_email ?? "",
        phone: notice.newcomer_contact_phone ?? "",
      },
    ];
  }

  return [{ name: "", email: "", phone: "" }];
}

export default async function EditServiceNoticePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const event = useMock
    ? mockDb.getEventById(id)
    : mosqueId
      ? await db.getEventById(id, mosqueId)
      : null;
  if (!event) notFound();

  const [notice, sends, mosque] =
    !useMock && mosqueId
      ? await Promise.all([
          db.getServiceNotice(id, mosqueId),
          db.listServiceNoticeSends(mosqueId, id),
          db.getMosqueById(mosqueId),
        ])
      : [null, [], useMock ? mockDb.listMosques()[0] ?? null : null];
  const defaultOpeningText = renderDefaultNoticeOpening(event, mosque);

  const noticeStatus = (event.notice_status ?? "none") as
    | "none"
    | "draft"
    | "approved"
    | "sent";

  return (
    <NoticeEditorClient
      eventId={id}
      eventTitle={event.title}
      eventType={event.event_type}
      sendHistory={JSON.parse(JSON.stringify(sends))}
      noticeStatus={noticeStatus}
      approvedAt={event.notice_approved_at ?? null}
      approvedByEmail={event.notice_approved_by_email ?? null}
      initial={{
        issue_date:
          notice?.issue_date ??
          new Date().toISOString().slice(0, 10),
        opening_text: notice?.opening_text ?? defaultOpeningText,
        agenda_items: notice?.agenda_items?.length
          ? notice.agenda_items
          : defaultAgendaItems(),
        menu_items: notice?.menu_items ?? [],
        dining_time: notice?.dining_time ?? "",
        notices: notice?.notices ?? [],
        include_member_directory: notice?.include_member_directory ?? true,
        newcomer_contacts: newcomerContactsFromNotice(notice),
        next_service_date: notice?.next_service_date ?? "",
        next_service_note: notice?.next_service_note ?? "",
        service_lead_name: notice?.service_lead_name ?? "",
        service_lead_role: notice?.service_lead_role ?? "",
      }}
    />
  );
}
