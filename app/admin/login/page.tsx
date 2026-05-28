"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        setLoading(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
        <Image
          src="/brand/lodgepay-admin-signin.png"
          alt="LodgePay"
          width={1024}
          height={1024}
          priority
          className="mb-4 h-24 w-24 object-contain sm:mb-6 sm:h-44 sm:w-44"
        />
        <h1 className="text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">Admin login</h1>
        <p className="mt-1.5 text-sm text-dash-muted sm:mt-2">Sign in to access the admin panel.</p>
      </div>

      <div className="admin-surface p-5 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              variant="dashboard"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              enterKeyHint="next"
              placeholder="admin@covenantlodge.org.uk"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/admin/forgot-password"
                className="text-xs font-medium text-dash-muted transition-colors hover:text-brand"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              variant="dashboard"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              enterKeyHint="go"
              placeholder="Password"
            />
          </div>
          <Button type="submit" variant="brand" className="h-12 w-full text-base sm:h-11 sm:text-sm" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-5 text-center sm:mt-6">
        <Link href="/" className="text-sm text-dash-muted transition-colors hover:text-brand">
          &larr; Back to site
        </Link>
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-dashboard-light flex min-h-[100dvh] items-center justify-center bg-dash-bg p-4 sm:p-6">
      <Suspense fallback={<div className="text-dash-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
