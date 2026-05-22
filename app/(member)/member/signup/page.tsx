"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle2 } from "lucide-react";

export default function MemberSignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const passwordReady = password.length >= 6;
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/member/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="admin-dashboard-light flex min-h-screen items-center justify-center bg-dash-bg px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-dash-text">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-dash-muted">
            We&apos;ve sent a verification link to <strong className="text-dash-text">{email}</strong>.
            Please click the link to activate your account.
          </p>
          <Link href="/member/login">
            <Button variant="brand" className="mt-8">
              Back to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-light flex min-h-screen items-center justify-center bg-dash-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Image
            src="/brand/lodgepay-admin-signin.png"
            alt="LodgePay"
            width={1024}
            height={1024}
            priority
            className="mb-6 h-36 w-36 object-contain"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-dash-text">Create your account</h1>
          <p className="mt-2 text-sm text-dash-muted">
            Optional access for past summons, RSVPs, dues, and profile details
          </p>
        </div>

        <div className="admin-surface p-8">
          <div className="mb-6 rounded-xl border border-[hsl(var(--dash-ring)/0.25)] bg-[hsl(var(--dash-ring)/0.06)] px-4 py-3 text-sm text-[hsl(var(--dash-ring-dark))]">
            You can still use secure email links without an account. Sign up if you want a permanent member dashboard.
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="fullName"
                  variant="dashboard"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="email"
                  variant="dashboard"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="password"
                  variant="dashboard"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`h-1.5 flex-1 rounded-full ${
                    passwordReady ? "bg-emerald-500" : "bg-dash-border"
                  }`}
                />
                <span className={passwordReady ? "text-emerald-700" : "text-dash-faint"}>
                  {passwordReady ? "Strong enough" : "At least 6 characters"}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="confirmPassword"
                  variant="dashboard"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
              {!passwordsMatch && (
                <p className="text-xs text-red-600">Passwords do not match.</p>
              )}
            </div>

            <Button
              type="submit"
              variant="brand"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating account…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Create account
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-dash-muted">
          Already have an account?{" "}
          <Link
            href="/member/login"
            className="font-medium text-brand transition-colors hover:text-brand-dark"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
