import { AdminSettingsTabs } from "@/components/admin/admin-settings-tabs";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Settings</h1>
          <p className="admin-page-copy">
            Manage the lodge profile, lodge team, and your personal admin profile.
          </p>
        </div>
      </div>

      <AdminSettingsTabs />
    </div>
  );
}
