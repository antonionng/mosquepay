import { resolveChurchSlug } from "@/lib/tenant";

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function tokenSegment(token: string) {
  return encodeURIComponent(token);
}

export function churchScopedEventPath(churchSlug: string, eventSlug: string) {
  return `/${resolveChurchSlug(churchSlug)}/events/${encodeURIComponent(eventSlug)}`;
}

export function churchScopedEventsPath(churchSlug: string) {
  return `/${resolveChurchSlug(churchSlug)}/events`;
}

export function churchScopedGuestPath(churchSlug: string, token: string) {
  return `/${resolveChurchSlug(churchSlug)}/guest/${tokenSegment(token)}`;
}

export function churchScopedGuestSuccessPath(churchSlug: string, token: string) {
  return `${churchScopedGuestPath(churchSlug, token)}/success`;
}

export function churchScopedNewcomerPath(churchSlug: string, token: string) {
  return `/${resolveChurchSlug(churchSlug)}/newcomers/church/${tokenSegment(token)}`;
}

export function churchScopedVisitPath(churchSlug: string) {
  return `/${resolveChurchSlug(churchSlug)}/newcomers`;
}

export function buildPublicUrl(baseUrl: string, path: string) {
  return `${cleanBaseUrl(baseUrl)}${path}`;
}
