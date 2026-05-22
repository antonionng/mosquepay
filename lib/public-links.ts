import { resolveLodgeSlug } from "@/lib/tenant";

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function tokenSegment(token: string) {
  return encodeURIComponent(token);
}

export function lodgeScopedEventPath(lodgeSlug: string, eventSlug: string) {
  return `/${resolveLodgeSlug(lodgeSlug)}/events/${encodeURIComponent(eventSlug)}`;
}

export function lodgeScopedEventsPath(lodgeSlug: string) {
  return `/${resolveLodgeSlug(lodgeSlug)}/events`;
}

export function lodgeScopedGuestPath(lodgeSlug: string, token: string) {
  return `/${resolveLodgeSlug(lodgeSlug)}/guest/${tokenSegment(token)}`;
}

export function lodgeScopedGuestSuccessPath(lodgeSlug: string, token: string) {
  return `${lodgeScopedGuestPath(lodgeSlug, token)}/success`;
}

export function lodgeScopedVisitorPath(lodgeSlug: string, token: string) {
  return `/${resolveLodgeSlug(lodgeSlug)}/visitor/${tokenSegment(token)}`;
}

export function lodgeScopedVisitPath(lodgeSlug: string) {
  return `/${resolveLodgeSlug(lodgeSlug)}/visit`;
}

export function buildPublicUrl(baseUrl: string, path: string) {
  return `${cleanBaseUrl(baseUrl)}${path}`;
}
