"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MemberForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/member/forgot-password", {
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
          "If a member portal account exists for that email, a password reset link is on its way."
      );
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="admin-dashboard-light flex min-h-[100dvh] items-center justify-center bg-dash-bg p-4 sm:p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center sm:mb-8">
          <Image
            src="/brand/mosquepay-admin-signin.png"
            alt="MosquePay"
            width={1200}
            height={800}
            priority
            className="mb-4 h-20 w-72 max-w-full object-contain sm:mb-6 sm:h-28 sm:w-96"
          />
          <h1 className="text-2xl font-semibold tracking-tight text-dash-text sm:text-3xl">
            Forgot password
          </h1>
          <p className="mt-1.5 text-sm text-dash-muted sm:mt-2">
            Enter the email on your member record and we&rsquo;ll send a reset link.
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
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
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
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-dash-faint" />
                  <Input
                    id="email"
                    name="email"
                    variant="dashboard"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="pl-10"
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

        <p className="mt-5 text-center text-sm text-dash-muted sm:mt-6">
          Remembered it?{" "}
          <Link
            href="/member/login"
            className="font-medium text-brand transition-colors hover:text-brand-dark"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
