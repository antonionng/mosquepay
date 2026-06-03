import * as db from "@/lib/db";

// Resolve the meeting "in session" right now for auto-attribution of
// take-payment takings. Deliberately conservative: only returns an id when
// there is EXACTLY ONE meeting dated today, so a routine standing QR is never
// silently pinned to the wrong (or an ambiguous) event. Returns null on any
// ambiguity or error.
export async function resolveTodaysMeetingId(
  lodgeId: string,
): Promise<string | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const events = await db.getEvents(lodgeId);
    const todays = events.filter(
      (e) =>
        typeof e.event_date === "string" &&
        e.event_date.slice(0, 10) === today,
    );
    if (todays.length === 1) return todays[0]!.id;
    return null;
  } catch {
    return null;
  }
}
