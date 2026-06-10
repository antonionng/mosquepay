import { EventsPageContent } from "@/app/(public)/events/page";

export default async function ChurchScopedEventsPage({
  params,
}: {
  params: Promise<{ churchSlug: string }>;
}) {
  const { churchSlug } = await params;
  return <EventsPageContent church={churchSlug} linkMode="scoped" />;
}
