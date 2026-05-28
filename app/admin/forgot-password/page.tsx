"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Could not send a reset email.");
        return;
      }
      setStatus("sent");
      setMessage(
        data.message ??
          "If an admin account exists for that email, a password reset link is on its way."
      );
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="admin-dashboard-light flex min-h-[100dvh] items-center justify-center bg-dash-bg p-4 sm:p-6">
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
          <h1 className="text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">
            Forgot password
          </h1>
          <p className="mt-1.5 text-sm text-dash-muted sm:mt-2">
            Enter your admin email and we&rsquo;ll send a password reset link.
          </p>
        </div>

        <div className="admin-surface p-5 sm:p-8">
          {status === "sent" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
              </div>
              <p className="text-sm text-dash-muted">
                Check your inbox, then follow the link to choose a new password.
                Links expire shortly for your security.
              </p>
              <Button
                type="button"
                variant="dashboard"
                className="w-full"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                  setMessage(null);
                }}
              >
                Send to a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {status === "error" && message ? (
                <div
                  role="alert"
                  aria-live="polite"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  variant="dashboard"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoComplete="email"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  inputMode="email"
                  enterKeyHint="go"
                  placeholder="you@example.com"
                />
              </div>

              <Button
                type="submit"
                variant="brand"
                className="h-12 w-full text-base sm:h-11 sm:text-sm"
                disabled={status === "sending"}
              >
                {status === "sending" ? "Sending..." : "Send reset link"}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center sm:mt-6">
          <Link
            href="/admin/login"
            className="text-sm text-dash-muted transition-colors hover:text-brand"
          >
            &larr; Back to admin login
          </Link>
        </p>
      </div>
    </div>
  );
}
