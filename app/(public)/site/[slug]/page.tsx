import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { MosqueHomepage } from "@/components/mosque-site/mosque-homepage";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromHost, resolveMosqueSlug } from "@/lib/tenant";

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

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mosque?: string }>;
}): Promise<Metadata> {
  const [{ slug }, { mosque }] = await Promise.all([params, searchParams]);
  const mosqueSlug = (await getPublicTenantSlug(mosque)) ?? resolveMosqueSlug(mosque);
  const siteMosque = isSupabaseConfigured()
    ? await db.getMosqueBySlug(mosqueSlug)
    : mockDb.getMosqueBySlug(mosqueSlug);
  const site = siteMosque
    ? isSupabaseConfigured()
      ? await db.getMosqueSite(siteMosque.id)
      : mockDb.getMosqueSite(mosqueSlug)
    : null;
  const page = site?.custom_pages?.find((item) => item.slug === slug && item.published);
  const title = page?.seo_title || page?.title || "Mosque page";
  const description = page?.seo_description || page?.description || undefined;
  const absoluteTitle = siteMosque ? `${title} | ${siteMosque.name}` : title;

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

export default async function MosqueCustomPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mosque?: string }>;
}) {
  const [{ slug }, { mosque }] = await Promise.all([params, searchParams]);
  const mosqueSlug = await getPublicTenantSlug(mosque);
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" />
        </div>
      }
    >
      <MosqueHomepage pageSlug={slug} initialMosqueSlug={mosqueSlug} />
    </Suspense>
  );
}
