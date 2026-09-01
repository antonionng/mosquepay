import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { mosqueScopedEventPath } from "@/lib/public-links";
import { isPubliclyVisible } from "@/lib/events/public-visibility";
import { MARKETING_GUIDES } from "@/lib/marketing/guides";

function siteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://www.mosque-pay.com";
  return url.startsWith("http") ? url : `https://${url}`;
}

const STATIC_PATHS = [
  "/",
  "/about",
  "/features",
  "/networks",
  "/pricing",
  "/contact",
  "/book-demo",
  "/privacy",
  "/terms",
  "/gdpr",
  "/cookies",
  "/join",
  "/charity",
  "/donate",
  "/faq",
  "/news",
  "/guides",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : path === "/guides" ? "weekly" : "monthly",
    priority: path === "/" ? 1.0 : path === "/guides" ? 0.8 : 0.7,
  }));

  const guideEntries: MetadataRoute.Sitemap = MARKETING_GUIDES.map((guide) => ({
    url: `${base}${guide.path}`,
    lastModified: new Date(`${guide.lastModified}T00:00:00.000Z`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  if (!isSupabaseConfigured()) return [...staticEntries, ...guideEntries];

  const dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const mosques = await db.listMosques();
    for (const mosque of mosques) {
      if (!mosque.is_active) continue;
      const events = await db.getEvents(mosque.id, { published: true });
      for (const event of events) {
        if (new Date(event.event_date) < now) continue;
        if (!isPubliclyVisible(event)) continue;
        dynamicEntries.push({
          url: `${base}${mosqueScopedEventPath(mosque.slug, event.slug)}`,
          lastModified: new Date(event.updated_at ?? event.created_at ?? now),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // tolerate db errors at sitemap build time
  }

  return [...staticEntries, ...guideEntries, ...dynamicEntries];
}
