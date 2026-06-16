import { EventsPageContent } from "@/app/(public)/events/page";

export default async function MosqueScopedEventsPage({
  params,
}: {
  params: Promise<{ mosqueSlug: string }>;
}) {
  const { mosqueSlug } = await params;
  return <EventsPageContent mosque={mosqueSlug} linkMode="scoped" />;
}
