import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { EmptyState } from "@/components/ui/empty-state";
import { Globe } from "lucide-react";
import { AdminWebsiteManager } from "@/components/site-builder/admin-website-manager";
import AdminBlogPage from "../blog/page";

export const dynamic = "force-dynamic";

export default async function AdminWebsitePage() {
  const ctx = await getAdminReadContext();

  if (ctx.mode !== "database" || !ctx.lodgeId) {
    return (
      <div className="space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Website</h1>
            <p className="admin-page-copy">
              Build the lodge website, manage brand settings, and publish news.
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

  const [lodge, site] = await Promise.all([
    db.getLodgeById(ctx.lodgeId),
    db.getLodgeSite(ctx.lodgeId),
  ]);

  if (!lodge) {
    redirect("/admin");
  }
  const blog = await AdminBlogPage();

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Website</h1>
          <p className="admin-page-copy">
            Build the public lodge site, manage brand settings, domains, and news.
          </p>
        </div>
      </div>

      <AdminWebsiteManager lodge={lodge} site={site} blog={blog} />
    </div>
  );
}
