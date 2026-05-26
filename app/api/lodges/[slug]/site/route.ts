import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import {
  mergeSectionStylesPreserve,
  sanitizeFooterSettings,
  sanitizeHeaderSettings,
  sanitizeCustomPages,
  sanitizeSiteSections,
} from "@/lib/site-section-style";
import { loadPublicSiteExtras } from "@/lib/lodge-site/public-payload";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const { slug } = await params;
  const lodgeSlug = resolveLodgeSlug(slug);

  if (isSupabaseConfigured()) {
    const lodge = await db.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    const site = await db.getLodgeSite(lodge.id);
    if (site && !site.published) {
      const forbidden = await requireAdminApiPermission("website:write", lodge.id);
      if (forbidden) {
        return NextResponse.json(
          { error: "Website is not published." },
          { status: 404 }
        );
      }
    }
    const extras = await loadPublicSiteExtras({
      lodgeId: lodge.id,
      lodgeSlug,
      currentCharityCampaignId: lodge.current_charity_campaign_id ?? null,
    });
    const normalized = normalizeSiteForResponse(site);
    return NextResponse.json({
      lodge,
      site: normalized ? { ...normalized, ...extras } : normalized,
    });
  }

  const lodge = mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  const site = mockDb.getLodgeSite(lodgeSlug);
  if (!site.published) {
    const forbidden = await requireAdminApiPermission("website:write", lodge.id);
    if (forbidden) {
      return NextResponse.json(
        { error: "Website is not published." },
        { status: 404 }
      );
    }
  }
  const extras = await loadPublicSiteExtras({
    lodgeId: null,
    lodgeSlug,
    currentCharityCampaignId: lodge.current_charity_campaign_id ?? null,
  });
  const normalized = normalizeSiteForResponse(site);
  return NextResponse.json({
    lodge,
    site: normalized ? { ...normalized, ...extras } : normalized,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const { slug } = await params;
    const lodgeSlug = resolveLodgeSlug(slug);
    const body = await request.json();

    const updates: {
      page_title?: string;
      page_description?: string | null;
      sections?: ReturnType<typeof sanitizeSiteSections>;
      custom_pages?: ReturnType<typeof sanitizeCustomPages>;
      header_settings?: ReturnType<typeof sanitizeHeaderSettings> | null;
      footer_settings?: ReturnType<typeof sanitizeFooterSettings> | null;
      published?: boolean;
    } = {};
    if (typeof body.page_title === "string") {
      updates.page_title = body.page_title.trim();
    }
    if ("page_description" in body) {
      updates.page_description =
        typeof body.page_description === "string" && body.page_description.trim()
          ? body.page_description.trim()
          : null;
    }
    if (Array.isArray(body.sections)) {
      updates.sections = sanitizeSiteSections(body.sections);
    }
    if (Array.isArray(body.custom_pages)) {
      updates.custom_pages = sanitizeCustomPages(body.custom_pages);
    }
    if ("header_settings" in body) {
      updates.header_settings =
        body.header_settings === null
          ? null
          : sanitizeHeaderSettings(body.header_settings);
    }
    if ("footer_settings" in body) {
      updates.footer_settings =
        body.footer_settings === null
          ? null
          : sanitizeFooterSettings(body.footer_settings);
    }
    if (typeof body.published === "boolean") {
      updates.published = body.published;
    }

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const forbidden = await requireAdminApiPermission("website:write", lodgeId);
      if (forbidden) return forbidden;
      let sectionsToSave = updates.sections;
      let customPagesToSave = updates.custom_pages;
      let headerSettingsToSave = updates.header_settings;
      let footerSettingsToSave = updates.footer_settings;
      if (sectionsToSave) {
        const prev = await db.getLodgeSite(lodgeId);
        sectionsToSave = mergeSectionStylesPreserve(sectionsToSave, prev?.sections);
        customPagesToSave = customPagesToSave ?? prev?.custom_pages ?? undefined;
        headerSettingsToSave = headerSettingsToSave ?? prev?.header_settings ?? undefined;
        footerSettingsToSave = footerSettingsToSave ?? prev?.footer_settings ?? undefined;
      }
      const site = await db.updateLodgeSite(lodgeId, {
        ...updates,
        sections: sectionsToSave,
        custom_pages: customPagesToSave,
        header_settings: headerSettingsToSave,
        footer_settings: footerSettingsToSave,
      });
      await writeAuditLog({
        lodgeId,
        action: "updated",
        entityType: "website",
        entityId: site.id,
        summary: `Updated lodge website ${site.page_title}`,
      });
      return NextResponse.json({ success: true, site });
    }

    const lodge = mockDb.getLodgeBySlug(lodgeSlug);
    if (!lodge) {
      return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
    }
    let sectionsToSave = updates.sections;
    let customPagesToSave = updates.custom_pages;
    let headerSettingsToSave = updates.header_settings;
    let footerSettingsToSave = updates.footer_settings;
    if (sectionsToSave) {
      const prev = mockDb.getLodgeSite(lodgeSlug);
      sectionsToSave = mergeSectionStylesPreserve(sectionsToSave, prev.sections);
      customPagesToSave = customPagesToSave ?? prev.custom_pages;
      headerSettingsToSave = headerSettingsToSave ?? prev.header_settings;
      footerSettingsToSave = footerSettingsToSave ?? prev.footer_settings;
    }
    const site = mockDb.updateLodgeSite(lodgeSlug, {
      ...updates,
      sections: sectionsToSave,
      custom_pages: customPagesToSave,
      header_settings: headerSettingsToSave,
      footer_settings: footerSettingsToSave,
    });
    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error("Lodge site update error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
