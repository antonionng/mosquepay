import { AdminSettingsTabs } from "@/components/admin/admin-settings-tabs";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-copy">
            Manage the church profile, church team, and your personal admin profile.
          </p>
        </div>
      </div>

      <AdminSettingsTabs />
    </div>
  );
}
