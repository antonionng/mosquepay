import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { AdminMeetingsClient } from "./meetings-client";

export default async function AdminMeetingsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const allEvents = useMock
    ? mockDb.getEvents({ published: true })
    : lodgeId
      ? await db.getEvents(lodgeId, { published: true })
      : [];

  const meetingTypes = ["regular_meeting", "lodge_meeting", "installation", "lodge_of_instruction", "committee", "emergency"];
  const meetings = allEvents.filter((e) => meetingTypes.includes(e.event_type));

  const rsvpMap: Record<string, Array<{ id: string; user_name: string; user_email: string; status: string }>> = {};
  for (const m of meetings) {
    const rsvps = useMock
      ? mockDb.getRsvpsByEventId(m.id)
      : lodgeId
        ? await db.getRsvpsByEventId(m.id, lodgeId)
        : [];
    rsvpMap[m.id] = rsvps.map((r) => ({
      id: r.id,
      user_name: r.user_name,
      user_email: r.user_email,
      status: r.status,
    }));
  }

  return (
    <AdminMeetingsClient
      meetings={JSON.parse(JSON.stringify(meetings))}
      rsvpMap={JSON.parse(JSON.stringify(rsvpMap))}
    />
  );
}
