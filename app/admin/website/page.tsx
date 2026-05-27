import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Globe } from "lucide-react";
import { AdminWebsiteManager } from "@/components/site-builder/admin-website-manager";
import { sanitizeCustomPages, sanitizeSiteSections } from "@/lib/site-section-style";

export const dynamic = "force-dynamic";

export default async function AdminWebsitePage() {
  const ctx = await getAdminReadContext();

  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Website</h1>
            <p className="admin-page-copy">
              Build the lodge website, manage brand settings, and connect domains.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Globe}
          title="Website needs a selected lodge"
          description="Connect Supabase and choose a lodge to edit the public website."
        />
      </div>
    );
  }

  const [lodge, rawSite] = await Promise.all([
    db.getLodgeById(ctx.lodgeId),
    db.getLodgeSite(ctx.lodgeId),
  ]);
  const site = rawSite
    ? {
        ...rawSite,
        sections: sanitizeSiteSections(rawSite.sections) ?? rawSite.sections,
        custom_pages: sanitizeCustomPages(rawSite.custom_pages) ?? rawSite.custom_pages,
      }
    : rawSite;

  if (!lodge) {
    redirect("/admin");
  }
  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Website</h1>
          <p className="admin-page-copy">
            Build the public lodge site, manage brand settings, and connect domains.
          </p>
        </div>
      </div>

      <AdminWebsiteManager lodge={lodge} site={site} />
    </div>
  );
}
