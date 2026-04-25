import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getLodgeSlugFromRequest } from "@/lib/tenant";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const lodgeSlug = getLodgeSlugFromRequest(request);
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.title != null) updates.title = body.title.trim();
    if (body.slug != null) updates.slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (body.excerpt != null) updates.excerpt = body.excerpt.trim() || null;
    if (body.content != null) updates.content = body.content.trim();
    if (typeof body.published === "boolean") {
      updates.published = body.published;
      updates.published_at = body.published ? (body.published_at ?? new Date().toISOString()) : null;
    }

    if (isSupabaseConfigured()) {
      const lodgeId = await db.resolveLodgeId(lodgeSlug);
      if (!lodgeId) {
        return NextResponse.json({ error: "Lodge not found." }, { status: 404 });
      }
      const updated = await db.updateBlogPost(id, lodgeId, updates as Parameters<typeof db.updateBlogPost>[2]);
      if (!updated) {
        return NextResponse.json({ error: "Post not found." }, { status: 404 });
      }
      return NextResponse.json({ id, success: true });
    }

    const updated = mockDb.updateBlogPost(id, updates as Parameters<typeof mockDb.updateBlogPost>[1], {
      lodge_slug: lodgeSlug,
    });

    if (!updated) {
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
    }

    return NextResponse.json({ id, success: true });
  } catch (e) {
    console.error("Blog PATCH API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
