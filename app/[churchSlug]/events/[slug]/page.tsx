import type { Metadata } from "next";
import {
  EventPageContent,
  generateMetadata as generatePublicEventMetadata,
} from "@/app/(public)/events/[slug]/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ churchSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { churchSlug, slug } = await params;
  return generatePublicEventMetadata({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({ church: churchSlug }),
  });
}

export default async function ChurchScopedEventPage({
  params,
}: {
  params: Promise<{ churchSlug: string; slug: string }>;
}) {
  const { churchSlug, slug } = await params;
  return <EventPageContent slug={slug} church={churchSlug} linkMode="scoped" />;
}
