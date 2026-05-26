import { Suspense } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { isPubliclyVisible } from "@/lib/events/public-visibility";

async function getScopedSitePayload(lodgeSlug: string) {
  const lodge = isSupabaseConfigured()
    ? await db.getLodgeBySlug(lodgeSlug)
    : mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) return null;

  const site = isSupabaseConfigured()
    ? await db.getLodgeSite(lodge.id)
    : mockDb.getLodgeSite(lodgeSlug);

  const rawEvents = isSupabaseConfigured()
    ? await db
        .getEvents(lodge.id, { published: true, upcoming: true })
        .catch(() => [])
    : mockDb.getEvents({
        lodge_slug: lodgeSlug,
        published: true,
        upcoming: true,
      });
  const upcomingPublicEvents = rawEvents
    .filter(isPubliclyVisible)
    .slice(0, 6)
    .map((event) => ({
      id: event.id,
      slug: event.slug,
      title: event.title,
      event_date: event.event_date,
      event_time: event.event_time,
      location: event.location,
      event_type: event.event_type,
    }));

  return {
    lodge,
    site: site
      ? {
          ...site,
          sections: sanitizeSiteSections(site.sections) ?? site.sections,
          custom_pages:
            sanitizeCustomPages(site.custom_pages) ?? site.custom_pages ?? [],
          upcoming_public_events: upcomingPublicEvents,
        }
      : null,
  };
}

export default async function LodgeScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lodgeSlug: string }>;
}) {
  const { lodgeSlug: rawLodgeSlug } = await params;
  const lodgeSlug = resolveLodgeSlug(rawLodgeSlug);
  const payload = await getScopedSitePayload(lodgeSlug);
  if (!payload) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader
          initialBranding={payload.lodge}
          initialHeaderSettings={payload.site?.header_settings ?? null}
          initialCustomPages={payload.site?.custom_pages ?? []}
          initialTenantSlug={lodgeSlug}
        />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense>
        <PublicFooter
          initialBranding={payload.lodge}
          initialFooterSettings={payload.site?.footer_settings ?? null}
          initialTenantSlug={lodgeSlug}
        />
      </Suspense>
    </div>
  );
}
