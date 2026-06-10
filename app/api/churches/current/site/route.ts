import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getChurchSlugFromHost, resolveChurchSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/church-site/public-payload";
import type { ChurchSiteCustomPage, ChurchSiteSection } from "@/lib/db/types";

function normalizeSiteForResponse<T extends { sections: ChurchSiteSection[]; custom_pages?: ChurchSiteCustomPage[] | null }>(
  site: T | null | undefined
) {
  if (!site) return site;
  return {
    ...site,
    sections: sanitizeSiteSections(site.sections) ?? site.sections,
    custom_pages: sanitizeCustomPages(site.custom_pages) ?? site.custom_pages,
  };
}

async function resolvePublicChurchSlug(request: NextRequest) {
  const querySlug = request.nextUrl.searchParams.get("church");
  if (querySlug) return resolveChurchSlug(querySlug);

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getChurchSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const church = await db.getChurchByCustomDomain(hostname);
  return church?.slug ?? null;
}

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const churchSlug = await resolvePublicChurchSlug(request);
  if (!churchSlug) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }

  if (isSupabaseConfigured()) {
    const church = await db.getChurchBySlug(churchSlug);
    if (!church) {
      return NextResponse.json({ error: "Church not found." }, { status: 404 });
    }
    const site = await db.getChurchSite(church.id);
    if (!site?.published) {
      return NextResponse.json({ error: "Website is not published." }, { status: 404 });
    }
    const extras = await loadPublicSiteExtras({
      churchId: church.id,
      churchSlug,
      currentCharityCampaignId: church.current_charity_campaign_id ?? null,
    });
    const normalized = normalizeSiteForResponse(site);
    return NextResponse.json({
      church,
      site: normalized ? { ...normalized, ...extras } : normalized,
    });
  }

  const church = mockDb.getChurchBySlug(churchSlug);
  if (!church) {
    return NextResponse.json({ error: "Church not found." }, { status: 404 });
  }
  const site = mockDb.getChurchSite(churchSlug);
  if (!site.published) {
    return NextResponse.json({ error: "Website is not published." }, { status: 404 });
  }
  const extras = await loadPublicSiteExtras({
    churchId: null,
    churchSlug,
    currentCharityCampaignId: church.current_charity_campaign_id ?? null,
  });
  const normalized = normalizeSiteForResponse(site);
  return NextResponse.json({
    church,
    site: normalized ? { ...normalized, ...extras } : normalized,
  });
}
