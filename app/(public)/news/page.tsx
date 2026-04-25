import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { Newspaper, ArrowRight } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { lodge } = await searchParams;
  const isTenantMode = Boolean(lodge);
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  if (!isTenantMode) {
    const updates = [
      {
        slug: "multi-tenant-rollout",
        title: "LodgePay multi-tenant rollout update",
        excerpt: "Tenant-safe routing, branding, and API scoping now power lodge-specific experiences.",
        published_at: "2026-04-08T10:00:00.000Z",
      },
      {
        slug: "ai-site-builder",
        title: "AI-assisted lodge site builder now available",
        excerpt: "Generate one-pager drafts, review diffs, and apply section changes with guardrails.",
        published_at: "2026-04-07T10:00:00.000Z",
      },
    ];

    return (
      <div className="public-page">
        <section className="public-hero">
          <div className="public-hero-shell">
            <div className="public-hero-copy">
              <p className="public-kicker">LodgePay Updates</p>
              <h1 className="public-hero-title">Product and platform news.</h1>
            </div>
          </div>
        </section>
        <section className="public-section">
          <div className="container-full">
            <div className="grid gap-6 md:grid-cols-2">
              {updates.map((post) => (
                <div key={post.slug} className="public-grid-card">
                  <p className="text-sm font-medium text-blue-600">{formatDate(post.published_at)}</p>
                  <h2 className="mt-3 text-xl font-semibold text-slate-950">{post.title}</h2>
                  <p className="mt-3 text-sm text-slate-600">{post.excerpt}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const useDb = isSupabaseConfigured();
  let posts: Array<{
    slug: string;
    title: string;
    excerpt: string | null;
    published_at: string | null;
  }>;

  if (useDb) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    const raw = lodgeId
      ? await db.getBlogPosts(lodgeId, { published: true })
      : [];
    posts = raw.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      published_at: p.published_at,
    }));
  } else {
    posts = mockDb.getBlogPosts({ published: true, lodge_slug: lodgeSlug }).map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      published_at: p.published_at,
    }));
  }

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="public-hero-shell">
          <div className="public-hero-copy">
            <p className="public-kicker">News</p>
            <h1 className="public-hero-title">Updates, announcements, and event recaps.</h1>
            <p className="public-hero-body">
              Follow recent activity from Covenant Lodge, including notices, recaps, and
              broader updates from the life of the lodge.
            </p>
          </div>
          <div className="public-hero-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Coverage</p>
            <div className="mt-6 space-y-3 text-sm text-slate-300">
              <p>Lodge announcements</p>
              <p>Event recaps</p>
              <p>News relevant to members and enquirers</p>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="container-full">
          {posts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((p) => (
                <Link 
                  key={p.slug} 
                  href={withLodgeQuery(`/news/${p.slug}`)}
                  className="group public-grid-card block h-full"
                >
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      {p.published_at ? formatDate(p.published_at) : ""}
                    </p>
                    <h2 className="mt-3 text-xl font-semibold text-slate-950 transition-colors group-hover:text-blue-700">
                      {p.title}
                    </h2>
                    {p.excerpt && (
                      <p className="mt-3 line-clamp-3 text-sm text-slate-600">{p.excerpt}</p>
                    )}
                    <div className="mt-6 flex items-center gap-1 text-sm font-medium text-blue-600">
                      Read article
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Newspaper className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-slate-900">No news yet</h3>
              <p className="text-slate-600 max-w-md mx-auto">
                Check back soon for updates and announcements from Covenant Lodge.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
