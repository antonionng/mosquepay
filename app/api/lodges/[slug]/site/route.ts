import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import {
  mergeSectionStylesPreserve,
  sanitizeSiteSections,
} from "@/lib/site-section-style";
import { requireAdminApiAuth, requireAdminApiPermission } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit";

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
    return NextResponse.json({ lodge, site });
  }

  const lodge = mockDb.getLodgeBySlug(lodgeSlug);
  if (!lodge) {
    return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
  }
  return NextResponse.json({
    lodge,
    site: mockDb.getLodgeSite(lodgeSlug),
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
      published?: boolean;
    } = {
      page_title: body.page_title?.trim(),
      page_description: body.page_description?.trim() ?? null,
      sections: Array.isArray(body.sections)
        ? sanitizeSiteSections(body.sections)
        : undefined,
    };
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
      if (sectionsToSave) {
        const prev = await db.getLodgeSite(lodgeId);
        sectionsToSave = mergeSectionStylesPreserve(sectionsToSave, prev?.sections);
      }
      const site = await db.updateLodgeSite(lodgeId, { ...updates, sections: sectionsToSave });
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
    if (sectionsToSave) {
      const prev = mockDb.getLodgeSite(lodgeSlug);
      sectionsToSave = mergeSectionStylesPreserve(sectionsToSave, prev.sections);
    }
    const site = mockDb.updateLodgeSite(lodgeSlug, { ...updates, sections: sectionsToSave });
    return NextResponse.json({ success: true, site });
  } catch (error) {
    console.error("Lodge site update error:", error);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
