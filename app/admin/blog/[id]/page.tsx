import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { BlogPostForm } from "@/components/forms/blog-post-form";

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const mosqueId = ctx.mode === "database" ? ctx.mosqueId : null;
  const post = useMock
    ? mockDb.getBlogPostById(id)
    : mosqueId
      ? await db.getBlogPostById(id, mosqueId)
      : null;

  if (!post) notFound();

  const defaultValues = {
    title: post.title as string,
    slug: post.slug as string,
    excerpt: (post.excerpt as string) ?? "",
    content: post.content as string,
    published: post.published === true,
  };

  return (
    <div>
      <div className="mb-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/blog">Back to blog</Link>
        </Button>
      </div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-dash-text">Edit post</h1>
      <p className="mb-8 text-dash-muted">{post.title as string}</p>
      <BlogPostForm postId={id} defaultValues={defaultValues} />
    </div>
  );
}
