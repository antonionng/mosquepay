import { notFound } from "next/navigation";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getDefaultChurchSlug } from "@/lib/tenant";
import { EventPageContent } from "@/app/(public)/events/[slug]/page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin preview",
  robots: { index: false, follow: false },
};

export default async function AdminServicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // `getAdminReadContext` redirects to /admin/login if not signed in as an
  // admin, so this route is implicitly gated.
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const churchId = ctx.mode === "database" ? ctx.churchId : null;
  const churchSlug =
    ctx.mode === "database" ? ctx.churchSlug : getDefaultChurchSlug();

  const event = useMock
    ? mockDb.getEventById(id)
    : churchId
      ? await db.getEventById(id, churchId)
      : null;
  if (!event) notFound();

  return (
    <EventPageContent
      slug={event.slug}
      church={churchSlug}
      linkMode="scoped"
      bypassVisibility
      adminPreviewBackHref={`/admin/services/${id}`}
    />
  );
}
