import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { LodgeHomepage } from "@/components/lodge-site/lodge-homepage";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import { StaticMarketingSite } from "@/components/marketing/static-marketing-site";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromHost, resolveLodgeSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";

async function getPublicTenantSlug(querySlug?: string) {
  if (querySlug) return resolveLodgeSlug(querySlug);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getLodgeSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const lodge = await db.getLodgeByCustomDomain(hostname);
  return lodge?.slug ?? null;
}

async function getPublicSitePayload(tenantSlug: string) {
  const siteLodge = isSupabaseConfigured()
    ? await db.getLodgeBySlug(tenantSlug)
    : mockDb.getLodgeBySlug(tenantSlug);
  if (!siteLodge) return null;

  const site = isSupabaseConfigured()
    ? await db.getLodgeSite(siteLodge.id)
    : mockDb.getLodgeSite(tenantSlug);
  if (!site) return null;

  return {
    lodge: siteLodge,
    site: {
      ...site,
      sections: sanitizeSiteSections(site.sections) ?? site.sections,
      custom_pages: sanitizeCustomPages(site.custom_pages) ?? site.custom_pages ?? [],
    },
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}): Promise<Metadata> {
  const { lodge } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(lodge);
  if (!tenantSlug) return {};

  const siteLodge = isSupabaseConfigured()
    ? await db.getLodgeBySlug(tenantSlug)
    : mockDb.getLodgeBySlug(tenantSlug);
  const site = siteLodge
    ? isSupabaseConfigured()
      ? await db.getLodgeSite(siteLodge.id)
      : mockDb.getLodgeSite(tenantSlug)
    : null;
  const title = site?.page_title || siteLodge?.name || "Lodge website";
  const description =
    site?.page_description ||
    siteLodge?.tagline ||
    "Visitor information, meetings, charity, membership enquiries, and lodge contact details.";

  return {
    title: {
      absolute: title,
    },
    description,
    openGraph: {
      title,
      description,
    },
  };
}

async function HomeContent({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const tenantSlug = await getPublicTenantSlug(lodge);

  if (tenantSlug) {
    const initialPayload = await getPublicSitePayload(tenantSlug);
    return (
      <div className="flex min-h-screen flex-col bg-white">
        <Suspense>
          <PublicHeader
            initialBranding={initialPayload?.lodge ?? null}
            initialHeaderSettings={initialPayload?.site.header_settings ?? null}
            initialCustomPages={initialPayload?.site.custom_pages ?? []}
            initialTenantSlug={tenantSlug}
          />
        </Suspense>
        <main className="flex-1">
          <LodgeHomepage initialLodgeSlug={tenantSlug} initialPayload={initialPayload} />
        </main>
        <Suspense>
          <PublicFooter
            initialBranding={initialPayload?.lodge ?? null}
            initialFooterSettings={initialPayload?.site.footer_settings ?? null}
            initialTenantSlug={tenantSlug}
          />
        </Suspense>
      </div>
    );
  }

  return <MarketingHomepage />;
}

function MarketingHomepage() {
  return <StaticMarketingSite initialPage="home" />;
}

export default function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-dash-bg">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-dash-border border-t-dash-ring" />
        </div>
      }
    >
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
