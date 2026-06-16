/**
 * Shared loader for the data the public mosque website needs that isn't
 * already on the `mosques` and `mosque_sites` rows. Used by both the
 * server-rendered routes (app/[mosqueSlug]/layout.tsx, app/(public)/page.tsx)
 * and the public JSON endpoints (app/api/mosques/[slug]/site,
 * app/api/mosques/current/site) so the public surface stays consistent
 * everywhere it is consumed.
 *
 * Privacy rules baked in here:
 *   - Events use `isPubliclyVisible` (regular mosque services stay hidden
 *     unless an admin explicitly opts them in via feature_on_website).
 *   - Officers use `members.show_on_website = true` AND
 *     `membership_status = active` (per-member opt-in, revocable).
 *   - Charity progress is only returned when an active campaign is
 *     pinned via `mosques.current_charity_campaign_id`.
 */

import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { isPubliclyVisible } from "@/lib/events/public-visibility";

export type PublicUpcomingEvent = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  event_type: string;
};

export type PublicOfficerSummary = {
  rung_id: string;
  rung_label: string;
  sort_order: number;
  member_id: string;
  full_name: string;
  rank: string | null;
  public_bio: string | null;
};

export type PublicCharityCampaign = {
  id: string;
  name: string;
  description: string | null;
  target_amount: number;
  raised_amount: number;
  start_date: string;
  end_date: string | null;
};

export type PublicSiteExtras = {
  upcoming_public_events: PublicUpcomingEvent[];
  public_officers: PublicOfficerSummary[];
  charity_campaign: PublicCharityCampaign | null;
};

type LoaderOpts = {
  mosqueId: string | null;
  mosqueSlug: string;
  currentCharityCampaignId: string | null;
};

const MAX_PUBLIC_EVENTS = 6;

export async function loadUpcomingPublicEvents(
  opts: Pick<LoaderOpts, "mosqueId" | "mosqueSlug">
): Promise<PublicUpcomingEvent[]> {
  const raw =
    isSupabaseConfigured() && opts.mosqueId
      ? await db
          .getEvents(opts.mosqueId, { published: true, upcoming: true })
          .catch(() => [])
      : !isSupabaseConfigured()
        ? mockDb.getEvents({
            mosque_slug: opts.mosqueSlug,
            published: true,
            upcoming: true,
          })
        : [];
  return raw
    .filter(isPubliclyVisible)
    .slice(0, MAX_PUBLIC_EVENTS)
    .map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      event_type: event.event_type,
    }));
}

export async function loadPublicOfficers(
  opts: Pick<LoaderOpts, "mosqueId">
): Promise<PublicOfficerSummary[]> {
  if (!isSupabaseConfigured() || !opts.mosqueId) return [];
  try {
    return await db.listPublicOfficers(opts.mosqueId);
  } catch {
    return [];
  }
}

export async function loadCharityCampaign(
  opts: Pick<LoaderOpts, "mosqueId" | "currentCharityCampaignId">
): Promise<PublicCharityCampaign | null> {
  if (
    !isSupabaseConfigured() ||
    !opts.mosqueId ||
    !opts.currentCharityCampaignId
  ) {
    return null;
  }
  try {
    const campaign = await db.getCharityCampaignById(
      opts.currentCharityCampaignId,
      opts.mosqueId
    );
    if (!campaign || campaign.status !== "active") return null;
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      target_amount: Number(campaign.target_amount) || 0,
      raised_amount: Number(campaign.raised_amount) || 0,
      start_date: campaign.start_date,
      end_date: campaign.end_date,
    };
  } catch {
    return null;
  }
}

export async function loadPublicSiteExtras(
  opts: LoaderOpts
): Promise<PublicSiteExtras> {
  const [upcoming_public_events, public_officers, charity_campaign] =
    await Promise.all([
      loadUpcomingPublicEvents(opts),
      loadPublicOfficers(opts),
      loadCharityCampaign(opts),
    ]);
  return { upcoming_public_events, public_officers, charity_campaign };
}
