import { Suspense } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { isSupabaseConfigured, shouldUseInMemoryMock } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { Newspaper, ArrowRight } from "lucide-react";
import { PublicFooter } from "@/components/layout/public-footer";
import { PublicHeader } from "@/components/layout/public-header";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";
import { getDefaultChurchSlug, resolveChurchSlug } from "@/lib/tenant";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "ChurchPay News | Product Updates for Church Software",
  description:
    "Read ChurchPay product updates covering giving and Gift Aid tools, church websites, service notices, member portals, newcomer follow-up, reporting, and multi-church administration.",
  path: "/news",
  keywords: [
    "ChurchPay news",
    "church software updates",
    "church platform updates",
    "church technology news",
  ],
});

const PRODUCT_UPDATES = [
  {
    slug: "multi-church-rollout",
    title: "Multi-church networks now fully supported",
    excerpt:
      "Per-church branding, records, and websites with central oversight, cross-church reporting, and one invoice for the whole network.",
    published_at: "2026-04-08T10:00:00.000Z",
  },
  {
    slug: "ai-site-builder",
    title: "AI-assisted church website builder",
    excerpt:
      "Generate page drafts, review changes side by side, and publish with guardrails. Built for volunteers, not developers.",
    published_at: "2026-04-07T10:00:00.000Z",
  },
  {
    slug: "gift-aid-claims",
    title: "HMRC-ready Gift Aid claim exports",
    excerpt:
      "Declarations attach to gifts automatically, GASDS collections are logged per service, and claims export with full evidence.",
    published_at: "2026-03-20T10:00:00.000Z",
  },
  {
    slug: "pastoral-care",
    title: "Pastoral care module with private access",
    excerpt:
      "Confidential care cases, visit logs, and gentle follow-up signals, visible only to your pastoral team.",
    published_at: "2026-03-05T10:00:00.000Z",
  },
];

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ church?: string }>;
}) {
  const { church } = await searchParams;
  const isTenantMode = Boolean(church);
  const churchSlug = resolveChurchSlug(church);
  const defaultSlug = getDefaultChurchSlug();
  const withChurchQuery = (href: string) =>
    churchSlug === defaultSlug ? href : `${href}?church=${encodeURIComponent(churchSlug)}`;

  if (!isTenantMode) {
    return (
      <MarketingShell>
        <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <MarketingKicker>Product news</MarketingKicker>
              <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                What&apos;s new in ChurchPay.
              </h1>
              <p className="mt-6 text-lg leading-8 text-slate-600">
                Updates and improvements across giving, websites, congregation tools, and
                reporting.
              </p>
            </div>
          </div>
        </section>
        <MarketingSection>
          <div className="grid gap-6 md:grid-cols-2">
            {PRODUCT_UPDATES.map((post) => (
              <article key={post.slug} className="rounded-3xl border border-[#e9e2d4] bg-white p-8">
                <p className="text-sm font-medium text-brand">{formatDate(post.published_at)}</p>
                <h2 className="mt-3 font-heading text-xl font-semibold text-slate-900">
                  {post.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">{post.excerpt}</p>
              </article>
            ))}
          </div>
        </MarketingSection>
      </MarketingShell>
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
    const churchId = await db.resolveChurchId(churchSlug);
    const raw = churchId
      ? await db.getBlogPosts(churchId, { published: true })
      : [];
    posts = raw.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      published_at: p.published_at,
    }));
  } else if (shouldUseInMemoryMock()) {
    posts = mockDb.getBlogPosts({ published: true, church_slug: churchSlug }).map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      published_at: p.published_at,
    }));
  } else {
    posts = [];
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense>
        <PublicHeader />
      </Suspense>
      <main className="flex-1">
        <div className="public-page">
          <section className="public-hero">
            <div className="public-hero-shell">
              <div className="public-hero-copy">
                <p className="public-kicker">News</p>
                <h1 className="public-hero-title">Updates, announcements, and stories.</h1>
                <p className="public-hero-body">
                  Follow what&apos;s happening in the life of our church: announcements, event
                  recaps, and news for members and newcomers.
                </p>
              </div>
              <div className="public-hero-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Coverage
                </p>
                <div className="mt-6 space-y-3 text-sm text-slate-300">
                  <p>Church announcements</p>
                  <p>Event recaps</p>
                  <p>News for members and newcomers</p>
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
                      href={withChurchQuery(`/news/${p.slug}`)}
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
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
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
                  <p className="mx-auto max-w-md text-slate-600">
                    Check back soon for updates and announcements from the church.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <Suspense>
        <PublicFooter />
      </Suspense>
    </div>
  );
}
