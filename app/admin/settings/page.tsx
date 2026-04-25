import { Card, CardContent } from "@/components/ui/card";
import { LodgePlatformSettings } from "@/components/forms/lodge-platform-settings";
import { MembershipFeesSettings } from "@/components/admin/membership-fees-settings";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-copy">
            Lodge SaaS configuration, one-pager content, and environment setup.
          </p>
        </div>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Environment variables</h2>
            <p className="dash-panel-header-description">
              Configure via .env.local: Supabase, Stripe, Resend, and admin credentials.
            </p>
          </div>
        </div>
        <CardContent className="border-t border-dash-border bg-dash-surface p-5 md:p-6">
          <p className="text-sm text-dash-text-muted">
            Default login:{" "}
            <span className="font-medium text-dash-text">admin@covenantlodge.org.uk</span> /{" "}
            <span className="font-medium text-dash-text">admin</span>
          </p>
        </CardContent>
      </Card>

      <MembershipFeesSettings />

      <div className="space-y-4">
        <div className="dash-panel-header rounded-xl border border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">Platform &amp; site</h2>
            <p className="dash-panel-header-description">
              Lodge profile, branding, and one-pager sections (dark theme controls below).
            </p>
          </div>
        </div>
        <LodgePlatformSettings />
      </div>
    </div>
  );
}
