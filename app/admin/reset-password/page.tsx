"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
          throw error ?? new Error("Reset link is invalid or has expired.");
        }

        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Reset link is invalid or has expired. Please request a new one."
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
      setMessage("Password updated. Redirecting to the admin dashboard.");
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

  const inputsDisabled = status === "error" && !password;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/brand/churchpay-admin-signin.png"
          alt="ChurchPay"
          width={1200}
          height={800}
          priority
          className="mb-6 h-44 w-44 object-contain"
        />
        <h1 className="text-3xl font-semibold tracking-tight text-dash-text">
          Reset your password
        </h1>
        <p className="mt-2 text-sm text-dash-muted">
          Choose a new password to sign in to the admin dashboard.
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
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                show={showPassword}
                onToggleShow={() => setShowPassword((current) => !current)}
                placeholder="At least 8 characters"
                disabled={inputsDisabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm password</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                show={showConfirmPassword}
                onToggleShow={() =>
                  setShowConfirmPassword((current) => !current)
                }
                placeholder="Re-enter your new password"
                disabled={inputsDisabled}
              />
            </div>
            <Button
              type="submit"
              variant="brand"
              className="w-full"
              disabled={saving || status === "error"}
            >
              {saving ? "Saving..." : "Save new password"}
            </Button>
          </form>
        )}
      </div>

      <p className="mt-6 text-center">
        <Link
          href="/admin/login"
          className="text-sm text-dash-muted transition-colors hover:text-brand"
        >
          &larr; Back to admin login
        </Link>
      </p>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        variant="dashboard"
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        required
        minLength={8}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="new-password"
        className="pr-11"
      />
      <button
        type="button"
        onClick={onToggleShow}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-dash-muted transition-colors hover:text-dash-text focus-visible:text-dash-text focus-visible:outline-none"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className="admin-dashboard-light flex min-h-screen items-center justify-center bg-dash-bg p-6">
      <Suspense fallback={<div className="text-dash-muted">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
