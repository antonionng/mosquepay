import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { ChurchHomepage } from "@/components/church-site/church-homepage";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromHost, resolveChurchSlug } from "@/lib/tenant";

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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ church?: string }>;
}): Promise<Metadata> {
  const [{ slug }, { church }] = await Promise.all([params, searchParams]);
  const churchSlug = (await getPublicTenantSlug(church)) ?? resolveChurchSlug(church);
  const siteChurch = isSupabaseConfigured()
    ? await db.getChurchBySlug(churchSlug)
    : mockDb.getChurchBySlug(churchSlug);
  const site = siteChurch
    ? isSupabaseConfigured()
      ? await db.getChurchSite(siteChurch.id)
      : mockDb.getChurchSite(churchSlug)
    : null;
  const page = site?.custom_pages?.find((item) => item.slug === slug && item.published);
  const title = page?.seo_title || page?.title || "Church page";
  const description = page?.seo_description || page?.description || undefined;
  const absoluteTitle = siteChurch ? `${title} | ${siteChurch.name}` : title;

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

export default async function ChurchCustomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ church?: string }>;
}) {
  const [{ slug }, { church }] = await Promise.all([params, searchParams]);
  const churchSlug = await getPublicTenantSlug(church);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
        </div>
      }
    >
      <ChurchHomepage pageSlug={slug} initialChurchSlug={churchSlug} />
    </Suspense>
  );
}
