"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  title: z.string().min(1, "Title is required"),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers, hyphens only"),
  excerpt: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  published: z.boolean().default(false),
});

type FormData = z.infer<typeof schema>;

const defaultSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function BlogPostForm({ postId, defaultValues }: { postId?: string; defaultValues?: Partial<FormData> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { published: false, ...defaultValues },
  });

  const title = watch("title");

  function syncSlug() {
    if (!postId && title) setValue("slug", defaultSlug(title));
  }

  async function onSubmit(data: FormData) {
    setError(null);
    try {
      const url = postId ? `/api/blog/${postId}` : "/api/blog";
      const method = postId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          published_at: data.published ? new Date().toISOString() : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save post");
      }
      const result = await res.json().catch(() => ({}));
      router.push(result.id ? `/admin/blog/${result.id}` : "/admin/blog");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input id="title" {...register("title")} onBlur={syncSlug} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">URL slug *</Label>
        <Input id="slug" {...register("slug")} placeholder="e.g. charity-event-2026" />
        {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Textarea id="excerpt" {...register("excerpt")} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="content">Content * (HTML)</Label>
        <Textarea id="content" {...register("content")} rows={12} className="font-mono text-sm" />
        {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="published" {...register("published")} className="h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500" />
        <Label htmlFor="published">Publish (visible on site)</Label>
      </div>
      <Button type="submit" disabled={isSubmitting} variant="primary">
        {isSubmitting ? "Saving..." : postId ? "Update post" : "Create post"}
      </Button>
    </form>
  );
}
