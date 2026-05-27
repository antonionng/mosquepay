import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultLodgeSlug } from "@/lib/tenant";
import { EventPageContent } from "@/app/(public)/events/[slug]/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin preview",
  robots: { index: false, follow: false },
};

export default async function AdminMeetingPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `getAdminReadContext` redirects to /admin/login if not signed in as an
  // admin, so this route is implicitly gated.
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const lodgeSlug =
    ctx.mode === "database" ? ctx.lodgeSlug : getDefaultLodgeSlug();

  const event = useMock
    ? mockDb.getEventById(id)
    : lodgeId
      ? await db.getEventById(id, lodgeId)
      : null;
  if (!event) notFound();

  return (
    <EventPageContent
      slug={event.slug}
      lodge={lodgeSlug}
      linkMode="scoped"
      bypassVisibility
      adminPreviewBackHref={`/admin/meetings/${id}`}
    />
  );
}
