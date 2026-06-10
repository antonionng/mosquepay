import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChurchHomepage } from "@/components/church-site/church-homepage";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromHost, resolveChurchSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/church-site/public-payload";
import { marketingMetadata, SOCIAL_SHARE_IMAGE } from "@/lib/seo";

async function getPublicTenantSlug(querySlug?: string) {
  if (querySlug) return resolveChurchSlug(querySlug);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getChurchSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const church = await db.getChurchByCustomDomain(hostname);
  return church?.slug ?? null;
}

async function getPublicSitePayload(tenantSlug: string) {
  const siteChurch = isSupabaseConfigured()
    ? await db.getChurchBySlug(tenantSlug)
    : mockDb.getChurchBySlug(tenantSlug);
  if (!siteChurch) return null;

  const site = isSupabaseConfigured()
    ? await db.getChurchSite(siteChurch.id)
    : mockDb.getChurchSite(tenantSlug);
  if (!site) return null;

  const extras = await loadPublicSiteExtras({
    churchId: isSupabaseConfigured() ? siteChurch.id : null,
    churchSlug: tenantSlug,
    currentCharityCampaignId: siteChurch.current_charity_campaign_id ?? null,
  });

  return {
    church: siteChurch,
    site: {
      ...site,
      sections: sanitizeSiteSections(site.sections) ?? site.sections,
      custom_pages: sanitizeCustomPages(site.custom_pages) ?? site.custom_pages ?? [],
      ...extras,
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}): Promise<Metadata> {
  const { church } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(church);
  if (!tenantSlug) {
    return marketingMetadata({
      title: "ChurchPay | Church Websites, Giving, Gift Aid, Events, and Congregation CRM",
      description:
        "ChurchPay helps churches and networks run modern operations: church websites, online giving, event payments, charity donations, Gift Aid, service notices, member portals, newcomer CRM, pastoral workflows, and reporting.",
      path: "/",
      keywords: [
        "church management software",
        "church member website platform",
        "church payments platform",
        "church operations software",
      ],
    });
  }

  const siteChurch = isSupabaseConfigured()
    ? await db.getChurchBySlug(tenantSlug)
    : mockDb.getChurchBySlug(tenantSlug);
  const site = siteChurch
    ? isSupabaseConfigured()
      ? await db.getChurchSite(siteChurch.id)
      : mockDb.getChurchSite(tenantSlug)
    : null;
  const title = site?.page_title || siteChurch?.name || "Church website";
  const description =
    site?.page_description ||
    siteChurch?.tagline ||
    "Newcomer information, services, charity, membership enquiries, and church contact details.";

  return {
    title: {
      absolute: title,
    },
    description,
    openGraph: {
      title,
      description,
      images: [SOCIAL_SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SOCIAL_SHARE_IMAGE.url],
    },
  };
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}) {
  const { church } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(church);

  if (tenantSlug) {
    const initialPayload = await getPublicSitePayload(tenantSlug);
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Suspense>
          <PublicHeader
            initialBranding={initialPayload?.church ?? null}
            initialHeaderSettings={initialPayload?.site.header_settings ?? null}
            initialCustomPages={initialPayload?.site.custom_pages ?? []}
            initialTenantSlug={tenantSlug}
          />
        </Suspense>
        <main className="flex-1">
          <ChurchHomepage initialChurchSlug={tenantSlug} initialPayload={initialPayload} />
        </main>
        <Suspense>
          <PublicFooter
            initialBranding={initialPayload?.church ?? null}
            initialFooterSettings={initialPayload?.site.footer_settings ?? null}
            initialTenantSlug={tenantSlug}
          />
        </Suspense>
      </div>
    );
  }

  return <MarketingHome />;
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#faf8f3]">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#e9e2d4] border-t-brand" />
        </div>
      }
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
