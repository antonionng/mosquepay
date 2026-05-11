import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromHost, resolveLodgeSlug } from "@/lib/tenant";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";
import type { LodgeSiteCustomPage, LodgeSiteSection } from "@/lib/db/types";

function normalizeSiteForResponse<T extends { sections: LodgeSiteSection[]; custom_pages?: LodgeSiteCustomPage[] | null }>(
  site: T | null | undefined
) {
  if (!site) return site;
  return {
    ...site,
    sections: sanitizeSiteSections(site.sections) ?? site.sections,
    custom_pages: sanitizeCustomPages(site.custom_pages) ?? site.custom_pages,
  };
}

async function resolvePublicLodgeSlug(request: NextRequest) {
  const querySlug = request.nextUrl.searchParams.get("lodge");
  if (querySlug) return resolveLodgeSlug(querySlug);

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const hostname = host?.split(":")[0]?.toLowerCase() ?? "";
  const subdomainSlug = getLodgeSlugFromHost(hostname);
  if (subdomainSlug) return subdomainSlug;

  if (!hostname || !isSupabaseConfigured()) return null;
  const lodge = await db.getLodgeByCustomDomain(hostname);
  return lodge?.slug ?? null;
}

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const lodgeSlug = await resolvePublicLodgeSlug(request);
  if (!lodgeSlug) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }

  if (isSupabaseConfigured()) {
    const lodge = await db.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const site = await db.getLodgeSite(lodge.id);
    if (!site?.published) {
      return NextResponse.json({ error: "Website is not published." }, { status: 404 });
    }
    return NextResponse.json({ lodge, site: normalizeSiteForResponse(site) });
  }

  const lodge = mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const site = mockDb.getLodgeSite(lodgeSlug);
  if (!site.published) {
    return NextResponse.json({ error: "Website is not published." }, { status: 404 });
  }
  return NextResponse.json({ lodge, site: normalizeSiteForResponse(site) });
}
