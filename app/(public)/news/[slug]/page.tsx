import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/db/with-fallback";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { ArrowLeft, User, Calendar } from "lucide-react";
import { getDefaultLodgeSlug, resolveLodgeSlug } from "@/lib/tenant";

export default async function NewsPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lodge?: string }>;
}) {
  const { slug } = await params;
  const { lodge } = await searchParams;
  const lodgeSlug = resolveLodgeSlug(lodge);
  const defaultSlug = getDefaultLodgeSlug();
  const withLodgeQuery = (href: string) =>
    lodgeSlug === defaultSlug ? href : `${href}?lodge=${encodeURIComponent(lodgeSlug)}`;

  const useDb = isSupabaseConfigured();
  let post;
  if (useDb) {
    const lodgeId = await db.resolveLodgeId(lodgeSlug);
    post = lodgeId ? await db.getBlogPostBySlug(slug, lodgeId) : null;
  } else {
    post = mockDb.getBlogPostBySlug(slug, { lodge_slug: lodgeSlug });
  }

  if (!post) notFound();

  return (
    <div className="public-page">
      <section className="public-hero">
        <div className="container-full relative z-10 max-w-4xl px-6 pb-16 pt-32 md:pb-20 md:pt-40">
          <Link 
            href={withLodgeQuery("/news")}
            className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-blue-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to news
          </Link>
          
          <div className="mb-6 flex items-center gap-4 text-sm text-white/60">
            {post.published_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-300" />
                {formatDate(post.published_at)}
              </div>
            )}
            {post.author_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-blue-300" />
                {post.author_name}
              </div>
            )}
          </div>
          
          <h1 className="text-4xl font-semibold leading-tight tracking-[-0.03em] text-white md:text-5xl">
            {post.title}
          </h1>
        </div>
      </section>

      <section className="public-section">
        <article className="container-full max-w-4xl">
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-semibold prose-headings:text-slate-950
              prose-p:text-slate-700 prose-p:leading-relaxed
              prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
              prose-strong:text-slate-950 prose-strong:font-semibold
              prose-li:text-slate-700
              prose-blockquote:border-l-blue-500 prose-blockquote:text-slate-700 prose-blockquote:italic
              prose-hr:border-slate-200"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </section>
      
      <section className="public-section public-section-muted">
        <div className="container-full max-w-3xl text-center">
          <p className="mb-4 text-slate-700">Want to stay updated?</p>
          <Link 
            href={withLodgeQuery("/news")}
            className="font-medium text-blue-600 hover:underline"
          >
            View all news and updates
          </Link>
        </div>
      </section>
    </div>
  );
}
