import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { LodgeHomepage } from "@/components/lodge-site/lodge-homepage";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromHost, resolveLodgeSlug } from "@/lib/tenant";

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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lodge?: string }>;
}): Promise<Metadata> {
  const [{ slug }, { lodge }] = await Promise.all([params, searchParams]);
  const lodgeSlug = (await getPublicTenantSlug(lodge)) ?? resolveLodgeSlug(lodge);
  const siteLodge = isSupabaseConfigured()
    ? await db.getLodgeBySlug(lodgeSlug)
    : mockDb.getLodgeBySlug(lodgeSlug);
  const site = siteLodge
    ? isSupabaseConfigured()
      ? await db.getLodgeSite(siteLodge.id)
      : mockDb.getLodgeSite(lodgeSlug)
    : null;
  const page = site?.custom_pages?.find((item) => item.slug === slug && item.published);
  const title = page?.seo_title || page?.title || "Lodge page";
  const description = page?.seo_description || page?.description || undefined;
  const absoluteTitle = siteLodge ? `${title} | ${siteLodge.name}` : title;

  return {
    title: {
      absolute: absoluteTitle,
    },
    description,
    openGraph: {
      title: absoluteTitle,
      description,
      images: page?.social_image_url ? [page.social_image_url] : undefined,
    },
  };
}

export default async function LodgeCustomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lodge?: string }>;
}) {
  const [{ slug }, { lodge }] = await Promise.all([params, searchParams]);
  const lodgeSlug = await getPublicTenantSlug(lodge);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
        </div>
      }
    >
      <LodgeHomepage pageSlug={slug} initialLodgeSlug={lodgeSlug} />
    </Suspense>
  );
}
