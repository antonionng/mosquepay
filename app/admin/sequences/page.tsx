import { getAdminReadContext } from "@/lib/admin/read-context";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { SequencesClient } from "./sequences-client";

export const dynamic = "force-dynamic";

export default async function AdminSequencesPage() {
  const ctx = await getAdminReadContext();
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;

  const sequences =
    isSupabaseConfigured() && lodgeId
      ? await db.listMeetingSequences(lodgeId)
      : [];

  const eventsBySequence: Record<
    string,
    Array<{
      id: string;
      title: string;
      slug: string;
      event_date: string;
      summons_status: string;
      summons_auto_drafted_at: string | null;
      summons_approved_at: string | null;
      summons_last_sent_at: string | null;
      published: boolean;
    }>
  > = {};

  if (lodgeId) {
    for (const sequence of sequences) {
      const events = await db.getEventsBySequenceId(sequence.id, lodgeId);
      eventsBySequence[sequence.id] = events.map((event) => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        event_date: event.event_date,
        summons_status: event.summons_status,
        summons_auto_drafted_at: event.summons_auto_drafted_at,
        summons_approved_at: event.summons_approved_at,
        summons_last_sent_at: event.summons_last_sent_at,
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
