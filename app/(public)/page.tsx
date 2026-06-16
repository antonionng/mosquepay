import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { MosqueHomepage } from "@/components/mosque-site/mosque-homepage";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { MarketingHome } from "@/components/marketing/marketing-home";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromHost, resolveMosqueSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/mosque-site/public-payload";
import { marketingMetadata, SOCIAL_SHARE_IMAGE } from "@/lib/seo";

async function getPublicTenantSlug(querySlug?: string) {
  if (querySlug) return resolveMosqueSlug(querySlug);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getMosqueSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const mosque = await db.getMosqueByCustomDomain(hostname);
  return mosque?.slug ?? null;
}

async function getPublicSitePayload(tenantSlug: string) {
  const siteMosque = isSupabaseConfigured()
    ? await db.getMosqueBySlug(tenantSlug)
    : mockDb.getMosqueBySlug(tenantSlug);
  if (!siteMosque) return null;

  const site = isSupabaseConfigured()
    ? await db.getMosqueSite(siteMosque.id)
    : mockDb.getMosqueSite(tenantSlug);
  if (!site) return null;

  const extras = await loadPublicSiteExtras({
    mosqueId: isSupabaseConfigured() ? siteMosque.id : null,
    mosqueSlug: tenantSlug,
    currentCharityCampaignId: siteMosque.current_charity_campaign_id ?? null,
  });

  return {
    mosque: siteMosque,
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
  searchParams: Promise<{ mosque?: string }>;
}): Promise<Metadata> {
  const { mosque } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(mosque);
  if (!tenantSlug) {
    return marketingMetadata({
      title: "MosquePay | Mosque Websites, Giving, Gift Aid, Events, and Congregation CRM",
      description:
        "MosquePay helps mosques and networks run modern operations: mosque websites, online giving, event payments, charity donations, Gift Aid, service notices, member portals, newcomer CRM, pastoral workflows, and reporting.",
      path: "/",
      keywords: [
        "mosque management software",
        "mosque member website platform",
        "mosque payments platform",
        "mosque operations software",
      ],
    });
  }

  const siteMosque = isSupabaseConfigured()
    ? await db.getMosqueBySlug(tenantSlug)
    : mockDb.getMosqueBySlug(tenantSlug);
  const site = siteMosque
    ? isSupabaseConfigured()
      ? await db.getMosqueSite(siteMosque.id)
      : mockDb.getMosqueSite(tenantSlug)
    : null;
  const title = site?.page_title || siteMosque?.name || "Mosque website";
  const description =
    site?.page_description ||
    siteMosque?.tagline ||
    "Newcomer information, services, charity, membership enquiries, and mosque contact details.";

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
  searchParams: Promise<{ mosque?: string }>;
}) {
  const { mosque } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(mosque);

  if (tenantSlug) {
    const initialPayload = await getPublicSitePayload(tenantSlug);
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Suspense>
          <PublicHeader
            initialBranding={initialPayload?.mosque ?? null}
            initialHeaderSettings={initialPayload?.site.header_settings ?? null}
            initialCustomPages={initialPayload?.site.custom_pages ?? []}
            initialTenantSlug={tenantSlug}
          />
        </Suspense>
        <main className="flex-1">
          <MosqueHomepage initialMosqueSlug={tenantSlug} initialPayload={initialPayload} />
        </main>
        <Suspense>
          <PublicFooter
            initialBranding={initialPayload?.mosque ?? null}
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
  searchParams: Promise<{ mosque?: string }>;
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
