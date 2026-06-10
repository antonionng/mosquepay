"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Save, UserCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ProfileMembership = {
  id: string;
  church_id: string | null;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
};

type ProfileResponse = {
  profile: {
    email: string;
    full_name: string;
    role: string;
    memberships: ProfileMembership[];
  };
};

export function AdminProfileSettings() {
  const [profile, setProfile] = useState<ProfileResponse["profile"] | null>(null);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      try {
        const response = await fetch("/api/admin/profile");
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error ?? "Could not load your profile.");
        }
        if (!active) return;
        const nextProfile = (data as ProfileResponse).profile;
        setProfile(nextProfile);
        setFullName(nextProfile.full_name);
      } catch (error) {
        if (!active) return;
        setMessage({
          type: "error",
          text: error instanceof Error ? error.message : "Could not load your profile.",
        });
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadProfile();
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not save your profile.");
      }
      const nextProfile = (data as ProfileResponse).profile;
      setProfile(nextProfile);
      setFullName(nextProfile.full_name);
      setMessage({ type: "success", text: "Profile saved." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not save your profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div>
          <h2 className="dash-panel-header-title flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            My profile
          </h2>
          <p className="dash-panel-header-description">
            Manage your own admin identity. Church roles are controlled by the church team.
          </p>
        </div>
      </div>
      <CardContent className="space-y-6 border-t border-dash-border bg-dash-surface p-5 md:p-6">
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-dash-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading profile...
          </div>
        ) : profile ? (
          <>
            <form onSubmit={saveProfile} className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <div className="space-y-2">
                <Label htmlFor="admin-profile-name">Full name</Label>
                <Input
                  id="admin-profile-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} disabled />
              </div>
              <Button type="submit" disabled={saving || !fullName.trim()}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save profile
              </Button>
            </form>

            <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4">
              <h3 className="text-sm font-semibold text-dash-text">Your church access</h3>
              <p className="mt-1 text-xs text-dash-muted">
                If you help with multiple churches, each assigned church appears in the church switcher.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {profile.memberships.map((membership) => (
                  <Badge key={membership.id} variant="secondary" className="border-dash-border">
                    {membership.role.replaceAll("_", " ")}
                    {membership.church_id ? "" : " · platform"}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
