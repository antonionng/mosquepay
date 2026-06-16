import type { Event, Mosque } from "@/lib/db/types";

type NoticeEvent = Pick<Event, "event_date" | "event_time" | "location" | "temple_room">;
type NoticeMosque = Pick<Mosque, "city"> | null | undefined;

export function defaultAgendaItems() {
  return [
    "Welcome and opening prayer.",
    "Worship and readings.",
    "Mosque family notices.",
    "PastoralCare update.",
    "Giving, Gift Aid, and charity focus.",
    "Upcoming services and events.",
    "Closing prayer and blessing.",
  ];
}

export function formatNoticeDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

export function formatNoticeTime(time: string | null) {
  if (!time) return "";
  const [hoursRaw, minutesRaw = "00"] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${hour12}.${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getNoticeVenue(event: NoticeEvent, mosque?: NoticeMosque) {
  return [
    event.location,
    event.temple_room,
    !event.location && mosque?.city ? mosque.city : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function renderDefaultNoticeOpening(event: NoticeEvent, mosque?: NoticeMosque) {
  const venue = getNoticeVenue(event, mosque) || "the mosque venue";
  const date = formatNoticeDate(event.event_date);
  const time = formatNoticeTime(event.event_time);
  const timeText = time ? ` at ${time} SHARP` : "";

  return [
    `You are invited to join this service at ${venue} on ${date}${timeText}.`,
    "With every blessing",
  ].join("\n\n");
}
