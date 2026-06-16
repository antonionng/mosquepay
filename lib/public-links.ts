import { resolveMosqueSlug } from "@/lib/tenant";

function cleanBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, "");
}

function tokenSegment(token: string) {
  return encodeURIComponent(token);
}

export function mosqueScopedEventPath(mosqueSlug: string, eventSlug: string) {
  return `/${resolveMosqueSlug(mosqueSlug)}/events/${encodeURIComponent(eventSlug)}`;
}

export function mosqueScopedEventsPath(mosqueSlug: string) {
  return `/${resolveMosqueSlug(mosqueSlug)}/events`;
}

export function mosqueScopedGuestPath(mosqueSlug: string, token: string) {
  return `/${resolveMosqueSlug(mosqueSlug)}/guest/${tokenSegment(token)}`;
}

export function mosqueScopedGuestSuccessPath(mosqueSlug: string, token: string) {
  return `${mosqueScopedGuestPath(mosqueSlug, token)}/success`;
}

export function mosqueScopedNewcomerPath(mosqueSlug: string, token: string) {
  return `/${resolveMosqueSlug(mosqueSlug)}/newcomers/mosque/${tokenSegment(token)}`;
}

export function mosqueScopedVisitPath(mosqueSlug: string) {
  return `/${resolveMosqueSlug(mosqueSlug)}/newcomers`;
}

export function buildPublicUrl(baseUrl: string, path: string) {
  return `${cleanBaseUrl(baseUrl)}${path}`;
}
