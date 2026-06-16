import { Suspense } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveMosqueSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/mosque-site/public-payload";

async function getScopedSitePayload(mosqueSlug: string) {
  const mosque = isSupabaseConfigured()
    ? await db.getMosqueBySlug(mosqueSlug)
    : mockDb.getMosqueBySlug(mosqueSlug);
  if (!mosque) return null;

  const site = isSupabaseConfigured()
    ? await db.getMosqueSite(mosque.id)
    : mockDb.getMosqueSite(mosqueSlug);

  const extras = await loadPublicSiteExtras({
    mosqueId: isSupabaseConfigured() ? mosque.id : null,
    mosqueSlug,
    currentCharityCampaignId: mosque.current_charity_campaign_id ?? null,
  });

  return {
    mosque,
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

export default async function MosqueScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ mosqueSlug: string }>;
}) {
  const { mosqueSlug: rawMosqueSlug } = await params;
  const mosqueSlug = resolveMosqueSlug(rawMosqueSlug);
  const payload = await getScopedSitePayload(mosqueSlug);
  if (!payload) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader
          initialBranding={payload.mosque}
          initialHeaderSettings={payload.site?.header_settings ?? null}
          initialCustomPages={payload.site?.custom_pages ?? []}
          initialTenantSlug={mosqueSlug}
        />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense>
        <PublicFooter
          initialBranding={payload.mosque}
          initialFooterSettings={payload.site?.footer_settings ?? null}
          initialTenantSlug={mosqueSlug}
        />
      </Suspense>
    </div>
  );
}
