"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { lodgeScopedVisitPath } from "@/lib/public-links";

type Props = {
  lodgeSlug: string;
  initialEnabled: boolean;
};

export function GuestSelfRegistrationCard({
  lodgeSlug,
  initialEnabled,
}: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${lodgeScopedVisitPath(lodgeSlug)}`
      : lodgeScopedVisitPath(lodgeSlug);

  async function toggle(next: boolean) {
    setError(null);
    setPending(true);
    const previous = enabled;
    setEnabled(next);
    try {
      const res = await fetch("/api/admin/guests/self-registration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepts_self_registration: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not update setting.");
      }
      router.refresh();
    } catch (err) {
      setEnabled(previous);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // noop
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-dash-text">
              Public registration link
            </h2>
          </div>
          <p className="mt-1 text-sm text-dash-muted">
            When enabled, the URL below is publicly reachable. Visitors can
            self-register and book themselves into open events. Off by default.
          </p>
          {enabled ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="rounded-md border border-dash-border bg-dash-surface-subtle px-2 py-1 font-mono text-xs">
                {publicUrl}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={copy}
              >
                {copied ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => window.open(publicUrl, "_blank", "noopener")}
              >
                Open
              </Button>
            </div>
          ) : null}
          {error ? (
            <p className="mt-2 text-sm text-destructive">{error}</p>
          ) : null}
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => toggle(event.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-dash-text">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>
    </Card>
  );
}
