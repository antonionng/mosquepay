import type { Event } from "@/lib/db/types";
import { mosqueScopedEventPath } from "@/lib/public-links";

const CRLF = "\r\n";

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toIcsDateTime(value: string, time?: string | null): string {
  const date = new Date(value);
  if (time) {
    const [hh, mm] = time.split(":");
    date.setUTCHours(Number(hh ?? 0), Number(mm ?? 0), 0, 0);
  }
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(
      date.getUTCDate()
    )}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
      date.getUTCSeconds()
    )}Z`
  );
}

function fold(line: string): string {
  if (line.length <= 75) return line;
  const out: string[] = [];
  let rest = line;
  while (rest.length > 75) {
    out.push(rest.slice(0, 75));
    rest = ` ${rest.slice(75)}`;
  }
  out.push(rest);
  return out.join(CRLF);
}

function escape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function eventsToIcs({
  calendarName,
  events,
  origin,
  mosqueSlug,
}: {
  calendarName: string;
  events: Event[];
  origin: string;
  mosqueSlug?: string | null;
}): string {
  const now = toIcsDateTime(new Date().toISOString());
  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//MosquePay//Member Portal//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escape(calendarName)}`);
  lines.push("METHOD:PUBLISH");

  for (const event of events) {
    const dtstart = toIcsDateTime(event.event_date, event.event_time);
    const endDate = new Date(event.event_date);
    if (event.event_time) {
      const [hh, mm] = event.event_time.split(":");
      endDate.setUTCHours(Number(hh ?? 0) + 3, Number(mm ?? 0), 0, 0);
    } else {
      endDate.setUTCHours(20, 0, 0, 0);
    }
    const dtend = toIcsDateTime(endDate.toISOString());

    const eventUrl = mosqueSlug
      ? `${origin}${mosqueScopedEventPath(mosqueSlug, event.slug)}`
      : `${origin}/events/${event.slug}`;
    const description = [
      event.description,
      event.dress_code ? `Dress: ${event.dress_code}` : null,
      `RSVP: ${eventUrl}`,
    ]
      .filter(Boolean)
      .join("\\n\\n");

    lines.push("BEGIN:VEVENT");
    lines.push(fold(`UID:${event.id}@mosquepayments`));
    lines.push(fold(`DTSTAMP:${now}`));
    lines.push(fold(`DTSTART:${dtstart}`));
    lines.push(fold(`DTEND:${dtend}`));
    lines.push(fold(`SUMMARY:${escape(event.title)}`));
    if (event.location) {
      const fullLocation = [event.location, event.temple_room]
        .filter(Boolean)
        .join(" - ");
      lines.push(fold(`LOCATION:${escape(fullLocation)}`));
    }
    lines.push(fold(`DESCRIPTION:${escape(description)}`));
    lines.push(fold(`URL:${eventUrl}`));
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join(CRLF) + CRLF;
}
