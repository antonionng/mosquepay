"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"checking" | "ready" | "saved" | "error">(
    "checking"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const supabase = createClient();
      const code = searchParams.get("code");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (window.location.hash.includes("access_token")) {
          const hash = new URLSearchParams(window.location.hash.slice(1));
          const accessToken = hash.get("access_token");
          const refreshToken = hash.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
            window.history.replaceState(null, "", window.location.pathname);
          }
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        if (error || !session) {
          throw error ?? new Error("Invite link is invalid or has expired.");
        }

        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Invite link is invalid or has expired."
        );
      }
    }

    void establishSession();
  }, [searchParams]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user?.email) {
        throw userError ?? new Error("Could not confirm your admin account.");
      }

      const login = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password }),
      });
      const loginData = await login.json().catch(() => ({}));
      if (!login.ok) {
        throw new Error(loginData.error ?? "Password saved, but sign in failed.");
      }

      setStatus("saved");
      setMessage("Password saved. Redirecting to the admin dashboard.");
      router.push("/admin");
      router.refresh();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Could not save your password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-dash-text">
          Accept Your Invite
        </h1>
        <p className="mt-2 text-sm text-dash-muted">
          Set your password to access the admin dashboard.
        </p>
      </div>

      <div className="admin-surface p-8">
        {status === "checking" ? (
          <div className="space-y-3 text-sm text-dash-muted">
            <div className="h-5 w-48 animate-pulse rounded bg-dash-border" />
            <div className="h-10 animate-pulse rounded-xl bg-dash-border/60" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={
                  status === "saved"
                    ? "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                    : "flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                }
              >
                {status === "saved" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                {message}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                disabled={status === "error" && !password}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                disabled={status === "error" && !password}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={saving || status === "error"}
            >
              {saving ? "Saving..." : "Set password"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center">
        <Link href="/admin/login" className="text-sm text-dash-muted hover:text-blue-600">
          Back to admin login
        </Link>
      </p>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <div className="admin-shell flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<div className="text-dash-muted">Loading...</div>}>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
