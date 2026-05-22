import { EventsPageContent } from "@/app/(public)/events/page";

export default async function LodgeScopedEventsPage({
  params,
}: {
  params: Promise<{ lodgeSlug: string }>;
}) {
  const { lodgeSlug } = await params;
  return <EventsPageContent lodge={lodgeSlug} linkMode="scoped" />;
}
