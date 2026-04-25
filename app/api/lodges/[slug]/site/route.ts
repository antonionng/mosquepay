import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { resolveLodgeSlug } from "@/lib/tenant";
import {
  mergeSectionStylesPreserve,
  sanitizeSiteSections,
} from "@/lib/site-section-style";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
  try {
    const { slug } = await params;
    const lodgeSlug = resolveLodgeSlug(slug);
    const body = await request.json();

    const updates = {
      page_title: body.page_title?.trim(),
      page_description: body.page_description?.trim() ?? null,
      sections: Array.isArray(body.sections)
        ? sanitizeSiteSections(body.sections)
        : undefined,
    };

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      let sectionsToSave = updates.sections;
      if (sectionsToSave) {
        const prev = await db.getLodgeSite(lodgeId);
        sectionsToSave = mergeSectionStylesPreserve(sectionsToSave, prev?.sections);
      }
      const site = await db.updateLodgeSite(lodgeId, { ...updates, sections: sectionsToSave });
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
