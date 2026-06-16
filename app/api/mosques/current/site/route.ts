import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromHost, resolveMosqueSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/mosque-site/public-payload";
import type { MosqueSiteCustomPage, MosqueSiteSection } from "@/lib/db/types";

function normalizeSiteForResponse<T extends { sections: MosqueSiteSection[]; custom_pages?: MosqueSiteCustomPage[] | null }>(
  site: T | null | undefined
) {
  if (!site) return site;
  return {
    ...site,
    sections: sanitizeSiteSections(site.sections) ?? site.sections,
    custom_pages: sanitizeCustomPages(site.custom_pages) ?? site.custom_pages,
  };
}

async function resolvePublicMosqueSlug(request: NextRequest) {
  const querySlug = request.nextUrl.searchParams.get("mosque");
  if (querySlug) return resolveMosqueSlug(querySlug);

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getMosqueSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const mosque = await db.getMosqueByCustomDomain(hostname);
  return mosque?.slug ?? null;
}

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const mosqueSlug = await resolvePublicMosqueSlug(request);
  if (!mosqueSlug) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }

  if (isSupabaseConfigured()) {
    const mosque = await db.getMosqueBySlug(mosqueSlug);
    if (!mosque) {
      return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
    }
    const site = await db.getMosqueSite(mosque.id);
    if (!site?.published) {
      return NextResponse.json({ error: "Website is not published." }, { status: 404 });
    }
    const extras = await loadPublicSiteExtras({
      mosqueId: mosque.id,
      mosqueSlug,
      currentCharityCampaignId: mosque.current_charity_campaign_id ?? null,
    });
    const normalized = normalizeSiteForResponse(site);
    return NextResponse.json({
      mosque,
      site: normalized ? { ...normalized, ...extras } : normalized,
    });
  }

  const mosque = mockDb.getMosqueBySlug(mosqueSlug);
  if (!mosque) {
    return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
  }
  const site = mockDb.getMosqueSite(mosqueSlug);
  if (!site.published) {
    return NextResponse.json({ error: "Website is not published." }, { status: 404 });
  }
  const extras = await loadPublicSiteExtras({
    mosqueId: null,
    mosqueSlug,
    currentCharityCampaignId: mosque.current_charity_campaign_id ?? null,
  });
  const normalized = normalizeSiteForResponse(site);
  return NextResponse.json({
    mosque,
    site: normalized ? { ...normalized, ...extras } : normalized,
  });
}
