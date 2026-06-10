"use client";

import { useEffect, useState } from "react";
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Lock,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Building,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GiftAidStatusPanel } from "@/components/member/gift-aid-onboarding";

interface UserProfile {
  full_name: string;
  email: string;
  phone?: string;
  dietary_requirements?: string;
  church_name?: string;
  church_number?: string;
  member_since?: string;
  gift_aid_declared: boolean;
}

function SkeletonForm() {
  return (
    <div className="space-y-6 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-20 rounded bg-slate-100" />
          <div className="h-11 w-full rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export default function MemberProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dietaryRequirements, setDietaryRequirements] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/auth/member/session");
        if (res.ok) {
          const data = await res.json();
          const p: UserProfile = {
            full_name: data.user?.full_name ?? "",
            email: data.user?.email ?? "",
            phone: data.user?.phone ?? "",
            dietary_requirements: data.user?.dietary_requirements ?? "",
            church_name: data.user?.church_name ?? "St Mary's Church",
            church_number: data.user?.church_number ?? "4344",
            member_since: data.user?.member_since,
            gift_aid_declared: data.user?.gift_aid_declared ?? false,
          };
          setProfile(p);
          setFullName(p.full_name);
          setEmail(p.email);
          setPhone(p.phone ?? "");
          setDietaryRequirements(p.dietary_requirements ?? "");
        }
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/member/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, phone, dietary_requirements: dietaryRequirements }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          setProfile({
            full_name: data.user.full_name ?? fullName,
            email: data.user.email ?? email,
            phone: data.user.phone ?? "",
            dietary_requirements: data.user.dietary_requirements ?? "",
            church_name: profile?.church_name,
            church_number: profile?.church_number,
            member_since: profile?.member_since,
            gift_aid_declared: profile?.gift_aid_declared ?? false,
          });
        }
        setMessage({ type: "success", text: "Profile updated successfully" });
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: data.error ?? "Failed to update profile" });
      }
    } catch {
      setMessage({ type: "error", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword !== confirmNew) {
      setPasswordMessage({ type: "error", text: "Passwords do not match" });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 6 characters",
      });
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch("/api/auth/member/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_password",
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setPasswordMessage({
          type: "error",
          text: data.error ?? "Failed to change password",
        });
        return;
      }

      setPasswordMessage({
        type: "success",
        text: "Password updated successfully",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNew("");
    } catch {
      setPasswordMessage({ type: "error", text: "Failed to change password" });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-slate-500 mt-1">Manage your account settings</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-slate-400" />
            Personal Information
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <SkeletonForm />
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {message && (
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                    message.type === "success"
                      ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                      : "bg-red-50 border border-red-100 text-red-700"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    autoComplete="name"
                    autoCapitalize="words"
                    enterKeyHint="next"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    disabled
                    autoComplete="email"
                    className="pl-10 bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Contact your church administrator to change your email
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone number</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+44 7700 900000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    autoComplete="tel"
                    inputMode="tel"
                    enterKeyHint="next"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dietary">Dietary requirements</Label>
                <div className="relative">
                  <UtensilsCrossed className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="dietary"
                    placeholder="e.g. Vegetarian, Gluten-free, No nuts"
                    value={dietaryRequirements}
                    onChange={(e) => setDietaryRequirements(e.target.value)}
                    className="pl-10"
                    autoComplete="off"
                    enterKeyHint="done"
                  />
                </div>
                <p className="text-xs text-slate-400">
                  This will be used for event RSVPs and dining arrangements
                </p>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Save className="h-4 w-4" />
                      Save Changes
                    </span>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Building className="h-4 w-4 text-slate-400" />
            Church Membership
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <SkeletonForm />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-slate-500">Church</p>
                <p className="text-base font-medium text-slate-900 mt-0.5">
                  {profile?.church_name ?? "Not recorded"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Church Number</p>
                <p className="text-base font-medium text-slate-900 mt-0.5">
                  No. {profile?.church_number ?? "Not recorded"}
                </p>
              </div>
              {profile?.member_since && (
                <div>
                  <p className="text-sm text-slate-500">Member Since</p>
                  <p className="text-base font-medium text-slate-900 mt-0.5">
                    {new Date(profile.member_since).toLocaleDateString("en-GB", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-slate-400" />
            Gift Aid Declaration
          </h2>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ) : (
            <GiftAidStatusPanel />
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            Security
          </h2>
        </div>
        <div className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-5 max-w-md">
            {passwordMessage && (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${
                  passwordMessage.type === "success"
                    ? "bg-emerald-50 border border-emerald-100 text-emerald-700"
                    : "bg-red-50 border border-red-100 text-red-700"
                }`}
              >
                {passwordMessage.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {passwordMessage.text}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  enterKeyHint="next"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNew">Confirm new password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmNew"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="go"
                  value={confirmNew}
                  onChange={(e) => setConfirmNew(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <Button type="submit" variant="secondary" disabled={changingPassword}>
              {changingPassword ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                  Updating…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Change Password
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
        <Badge variant="muted">
          <Shield className="h-3 w-3 mr-1" />
          Secured
        </Badge>
        <p className="text-xs text-slate-400">
          Your data is encrypted and protected. Contact your church administrator for account issues.
        </p>
      </div>
    </div>
  );
}
