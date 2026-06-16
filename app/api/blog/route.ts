import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import { rejectIfMockDisabled } from "@/lib/db/reject-mock";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getMosqueSlugFromRequest } from "@/lib/tenant";
import { requireAdminApiAuth } from "@/lib/auth/api";

export async function GET(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  const mosqueSlug = getMosqueSlugFromRequest(request);

  if (isSupabaseConfigured()) {
    const mosqueId = await db.resolveMosqueId(mosqueSlug);
    if (!mosqueId) {
      return NextResponse.json([]);
    }
    const posts = await db.getBlogPosts(mosqueId, { published: true });
    return NextResponse.json(posts);
  }

  const posts = mockDb
    .getBlogPosts({ mosque_slug: mosqueSlug })
    .filter((post) => post.published);
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const _rejectMock = rejectIfMockDisabled();
  if (_rejectMock) return _rejectMock;

  try {
    const unauthorized = await requireAdminApiAuth();
    if (unauthorized) return unauthorized;

    const mosqueSlug = getMosqueSlugFromRequest(request);
    const body = await request.json();
    const title = body.title?.trim();
    const slug = body.slug?.trim()?.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const content = body.content?.trim();
    if (!title || !slug || !content) {
      return NextResponse.json(
        { error: "Title, slug, and content are required." },
        { status: 400 }
      );
    }

    const postData = {
      title,
      slug,
      excerpt: body.excerpt?.trim() ?? null,
      content,
      featured_image_url: null,
      category: null,
      author_name: "Admin",
      published: body.published === true,
      published_at: body.published_at ?? null,
    };

    if (isSupabaseConfigured()) {
      const mosqueId = await db.resolveMosqueId(mosqueSlug);
      if (!mosqueId) {
        return NextResponse.json({ error: "Mosque not found." }, { status: 404 });
      }
      const post = await db.addBlogPost(mosqueId, {
        ...postData,
        tags: null,
        meta_description: null,
        meta_keywords: null,
        author_id: null,
      });
      return NextResponse.json({ id: post.id, success: true });
    }

    const post = mockDb.addBlogPost({ ...postData, mosque_slug: mosqueSlug });
    return NextResponse.json({ id: post.id, success: true });
  } catch (e) {
    console.error("Blog API error:", e);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 }
    );
  }
}
