import { Suspense } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/lodge-site/public-payload";

async function getScopedSitePayload(lodgeSlug: string) {
  const lodge = isSupabaseConfigured()
    ? await db.getLodgeBySlug(lodgeSlug)
    : mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) return null;

  const site = isSupabaseConfigured()
    ? await db.getLodgeSite(lodge.id)
    : mockDb.getLodgeSite(lodgeSlug);

  const extras = await loadPublicSiteExtras({
    lodgeId: isSupabaseConfigured() ? lodge.id : null,
    lodgeSlug,
    currentCharityCampaignId: lodge.current_charity_campaign_id ?? null,
  });

  return {
    lodge,
    site: site
      ? {
          ...site,
          sections: sanitizeSiteSections(site.sections) ?? site.sections,
          custom_pages:
            sanitizeCustomPages(site.custom_pages) ?? site.custom_pages ?? [],
          ...extras,
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
