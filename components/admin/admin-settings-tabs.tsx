"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { StaffSettings } from "@/components/admin/staff-settings";
import { AdminProfileSettings } from "@/components/admin/admin-profile-settings";
import { LodgeProfileSettings } from "@/components/forms/lodge-profile-settings";

export function AdminSettingsTabs() {
  return (
    <Tabs defaultValue="lodge" className="space-y-6">
      <TabsList>
        <TabsTrigger value="lodge">Lodge profile</TabsTrigger>
        <TabsTrigger value="team">Lodge team</TabsTrigger>
        <TabsTrigger value="profile">My profile</TabsTrigger>
      </TabsList>

      <TabsContent value="lodge">
        <LodgeProfileSettings />
      </TabsContent>

      <TabsContent value="team">
        <StaffSettings />
      </TabsContent>

      <TabsContent value="profile">
        <AdminProfileSettings />
      </TabsContent>
    </Tabs>
  );
}
