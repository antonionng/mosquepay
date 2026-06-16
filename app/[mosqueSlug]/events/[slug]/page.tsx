import type { Metadata } from "next";
import {
  EventPageContent,
  generateMetadata as generatePublicEventMetadata,
} from "@/app/(public)/events/[slug]/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ mosqueSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { mosqueSlug, slug } = await params;
  return generatePublicEventMetadata({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({ mosque: mosqueSlug }),
  });
}

export default async function MosqueScopedEventPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string; slug: string }>;
}) {
  const { mosqueSlug, slug } = await params;
  return <EventPageContent slug={slug} mosque={mosqueSlug} linkMode="scoped" />;
}
