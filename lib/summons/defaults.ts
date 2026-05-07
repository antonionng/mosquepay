import type { Event, Lodge } from "@/lib/db/types";

type SummonsEvent = Pick<Event, "event_date" | "event_time" | "location" | "temple_room">;
type SummonsLodge = Pick<Lodge, "city"> | null | undefined;

export function defaultAgendaItems() {
  return [
    "To open the Lodge.",
    "To submit for confirmation the circulated Minutes of the last regular meeting.",
    "To receive correspondence and apologies.",
    "To conduct the business of the Lodge.",
    "To receive the Almoner's report.",
    "To receive the Charity Steward's report and collect alms.",
    "Risings.",
    "To close the Lodge.",
  ];
}

export function formatSummonsDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(date));
}

export function formatSummonsTime(time: string | null) {
  if (!time) return "";
  const [hoursRaw, minutesRaw = "00"] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return time;

  const suffix = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${hour12}.${String(minutes).padStart(2, "0")} ${suffix}`;
}

export function getSummonsVenue(event: SummonsEvent, lodge?: SummonsLodge) {
  return [
    event.location,
    event.temple_room,
    !event.location && lodge?.city ? lodge.city : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function renderDefaultSummonsOpening(event: SummonsEvent, lodge?: SummonsLodge) {
  const venue = getSummonsVenue(event, lodge) || "the lodge venue";
  const date = formatSummonsDate(event.event_date);
  const time = formatSummonsTime(event.event_time);
  const timeText = time ? ` at ${time} SHARP` : "";

  return [
    `By Command of the Worshipful Master, you are summoned to attend a regular meeting of this Lodge to be held at ${venue} on ${date}${timeText}.`,
    "Yours faithfully and fraternally",
  ].join("\n\n");
}
