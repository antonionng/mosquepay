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
      <div className="mb-8 flex flex-col items-center text-center">
        <Image
          src="/brand/lodgepay-admin-signin.png"
          alt="LodgePay"
          width={1024}
          height={1024}
          priority
          className="mb-6 h-44 w-44 object-contain"
        />
        <h1 className="text-3xl font-semibold tracking-tight text-dash-text">Admin Login</h1>
        <p className="mt-2 text-sm text-dash-muted">Sign in to access the admin panel.</p>
      </div>
      
      <div className="admin-surface p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              variant="dashboard"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@covenantlodge.org.uk"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              variant="dashboard"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
            />
          </div>
          <Button type="submit" variant="brand" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center">
        <Link href="/" className="text-sm text-dash-muted transition-colors hover:text-brand">
          ← Back to site
        </Link>
      </p>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-dashboard-light flex min-h-screen items-center justify-center bg-dash-bg p-6">
      <Suspense fallback={<div className="text-dash-muted">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
