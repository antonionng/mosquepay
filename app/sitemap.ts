import type { MetadataRoute } from "next";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import { churchScopedEventPath } from "@/lib/public-links";
import { isPubliclyVisible } from "@/lib/events/public-visibility";

function siteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://www.churchpay.co.uk";
  return url.startsWith("http") ? url : `https://${url}`;
}

const STATIC_PATHS = [
  "/",
  "/about",
  "/features",
  "/contact",
  "/book-demo",
  "/privacy",
  "/terms",
  "/gdpr",
  "/join",
  "/charity",
  "/donate",
  "/about",
  "/faq",
  "/news",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1.0 : 0.7,
  }));

  if (!isSupabaseConfigured()) return staticEntries;

  const dynamicEntries: MetadataRoute.Sitemap = [];
  try {
    const churches = await db.listChurches();
    for (const church of churches) {
      if (!church.is_active) continue;
      const events = await db.getEvents(church.id, { published: true });
      for (const event of events) {
        if (new Date(event.event_date) < now) continue;
        if (!isPubliclyVisible(event)) continue;
        dynamicEntries.push({
          url: `${base}${churchScopedEventPath(church.slug, event.slug)}`,
          lastModified: new Date(event.updated_at ?? event.created_at ?? now),
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }
    }
  } catch {
    // tolerate db errors at sitemap build time
  }

  return [...staticEntries, ...dynamicEntries];
}
