import { getAdminReadContext } from "@/lib/admin/read-context";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { SequencesClient } from "./sequences-client";

export const dynamic = "force-dynamic";

export default async function AdminSequencesPage() {
  const ctx = await getAdminReadContext();
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;

  const sequences =
    isSupabaseConfigured() && mosqueId
      ? await db.listServiceSequences(mosqueId)
      : [];

  const eventsBySequence: Record<
    string,
    Array<{
      id: string;
      title: string;
      slug: string;
      event_date: string;
      notice_status: string;
      notice_auto_drafted_at: string | null;
      notice_approved_at: string | null;
      notice_last_sent_at: string | null;
      published: boolean;
    }>
  > = {};

  if (mosqueId) {
    for (const sequence of sequences) {
      const events = await db.getEventsBySequenceId(sequence.id, mosqueId);
      eventsBySequence[sequence.id] = events.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        event_date: event.event_date,
        notice_status: event.notice_status,
        notice_auto_drafted_at: event.notice_auto_drafted_at,
        notice_approved_at: event.notice_approved_at,
        notice_last_sent_at: event.notice_last_sent_at,
        published: event.published,
      }));
    }
  }

  return (
    <SequencesClient
      sequences={JSON.parse(JSON.stringify(sequences))}
      eventsBySequence={JSON.parse(JSON.stringify(eventsBySequence))}
      databaseConfigured={isSupabaseConfigured()}
    />
  );
}
