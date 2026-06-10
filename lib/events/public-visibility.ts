/**
 * Single source of truth for whether an event is allowed to appear on the
 * public church website (homepage events block, /events list, /events/[slug]
 * detail page, public ICS feed, sitemap, newcomer self-registration event
 * list, AI draft suggestions, etc).
 *
 * The rule, in priority order:
 *   1. published = true                            (always required)
 *   2. guest_policy != 'closed'                    (no closed events ever)
 *   3. event_type in PUBLIC_EVENT_TYPES            (naturally public)
 *      OR feature_on_website = true                (admin override)
 *
 * Regular church services and churches of instruction are private by default.
 * If an admin wants a specific special_service or special_service on the public
 * site they flip `feature_on_website` in the service form.
 *
 * Keep this file the only place that encodes this rule. Adding a new public
 * surface? Filter through `isPubliclyVisible` (or `filterPubliclyVisible`).
 */

export type PublicVisibilityEvent = {
  published: boolean;
  guest_policy: "blue_table" | "white_table" | "closed";
  event_type: string;
  feature_on_website?: boolean | null;
};

/** Event types that are naturally suitable for the public website. */
export const PUBLIC_EVENT_TYPES: ReadonlySet<string> = new Set([
  "social",
  "charity",
]);

export function isPubliclyVisible(event: PublicVisibilityEvent): boolean {
  if (!event.published) return false;
  if (event.guest_policy === "closed") return false;
  if (PUBLIC_EVENT_TYPES.has(event.event_type)) return true;
  return event.feature_on_website === true;
}

export function filterPubliclyVisible<T extends PublicVisibilityEvent>(
  events: ReadonlyArray<T>
): T[] {
  return events.filter(isPubliclyVisible);
}
