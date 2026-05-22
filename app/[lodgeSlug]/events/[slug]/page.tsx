import type { Metadata } from "next";
import {
  EventPageContent,
  generateMetadata as generatePublicEventMetadata,
} from "@/app/(public)/events/[slug]/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lodgeSlug: string; slug: string }>;
}): Promise<Metadata> {
  const { lodgeSlug, slug } = await params;
  return generatePublicEventMetadata({
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve({ lodge: lodgeSlug }),
  });
}

export default async function LodgeScopedEventPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string; slug: string }>;
}) {
  const { lodgeSlug, slug } = await params;
  return <EventPageContent slug={slug} lodge={lodgeSlug} linkMode="scoped" />;
}
