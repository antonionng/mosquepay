import { Suspense } from "react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveChurchSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/church-site/public-payload";

async function getScopedSitePayload(churchSlug: string) {
  const church = isSupabaseConfigured()
    ? await db.getChurchBySlug(churchSlug)
    : mockDb.getChurchBySlug(churchSlug);
  if (!church) return null;

  const site = isSupabaseConfigured()
    ? await db.getChurchSite(church.id)
    : mockDb.getChurchSite(churchSlug);

  const extras = await loadPublicSiteExtras({
    churchId: isSupabaseConfigured() ? church.id : null,
    churchSlug,
    currentCharityCampaignId: church.current_charity_campaign_id ?? null,
  });

  return {
    church,
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

export default async function ChurchScopedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug: rawChurchSlug } = await params;
  const churchSlug = resolveChurchSlug(rawChurchSlug);
  const payload = await getScopedSitePayload(churchSlug);
  if (!payload) {
    return <div className="min-h-screen bg-white">{children}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader
          initialBranding={payload.church}
          initialHeaderSettings={payload.site?.header_settings ?? null}
          initialCustomPages={payload.site?.custom_pages ?? []}
          initialTenantSlug={churchSlug}
        />
      </Suspense>
      <main className="flex-1">{children}</main>
      <Suspense>
        <PublicFooter
          initialBranding={payload.church}
          initialFooterSettings={payload.site?.footer_settings ?? null}
          initialTenantSlug={churchSlug}
        />
      </Suspense>
    </div>
  );
}
