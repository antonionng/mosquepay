import type { MetadataRoute } from "next";

function siteUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "https://www.mosque-pay.com";
  return url.startsWith("http") ? url : `https://${url}`;
}

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/member", "/operator", "/oauth"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
