"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";

function MemberLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/member";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/member/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="admin-dashboard-light flex min-h-[100dvh] items-center justify-center bg-dash-bg p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <Image
            src="/brand/churchpay-admin-signin.png"
            alt="ChurchPay"
            width={1200}
            height={800}
            priority
            className="mb-4 h-20 w-72 max-w-full object-contain sm:mb-6 sm:h-28 sm:w-96"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">Welcome back</h1>
          <p className="mt-1.5 text-sm text-dash-muted sm:mt-2">Sign in to your member portal</p>
        </div>

        <div className="admin-surface p-5 sm:p-8">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 sm:mb-6"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="email"
                  name="email"
                  variant="dashboard"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  enterKeyHint="next"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/member/forgot-password"
                  className="text-xs font-medium text-dash-muted transition-colors hover:text-brand"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                <Input
                  id="password"
                  name="password"
                  variant="dashboard"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="brand"
              className="h-12 w-full text-base sm:h-11 sm:text-sm"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign in
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-dash-muted sm:mt-6">
          Need access? Ask your church Secretary or admin to send a member invite.
        </p>
        <p className="mt-3 text-center text-sm text-dash-muted">
          Are you an officer or admin?{" "}
          <Link
            href="/admin/login"
            className="font-medium text-brand transition-colors hover:text-brand-dark"
          >
            Admin login
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function MemberLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-dashboard-light flex min-h-[100dvh] items-center justify-center bg-dash-bg p-4 sm:p-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-dash-border border-t-brand" />
        </div>
      }
    >
      <MemberLoginContent />
    </Suspense>
  );
}
