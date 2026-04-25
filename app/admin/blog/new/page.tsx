import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlogPostForm } from "@/components/forms/blog-post-form";

export default function NewBlogPostPage() {
  return (
    <div>
      <div className="mb-8">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/blog">Back to blog</Link>
        </Button>
      </div>
      <h1 className="mb-2 text-3xl font-semibold tracking-tight text-dash-text">New post</h1>
      <p className="mb-8 text-dash-muted">Create a new blog post.</p>
      <BlogPostForm />
    </div>
  );
}
