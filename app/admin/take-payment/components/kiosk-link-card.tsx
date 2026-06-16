"use client";

// Self-service kiosk link card.
//
// Shown at the bottom of the take-payment page so the duty team can grab the
// public kiosk URL, open it full-screen on the door tablet, or copy it into
// the mosque website. The kiosk itself is public and auth-less, so this card
// is purely a convenience pointer; nothing here gates access to it.

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, TabletSmartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function KioskLinkCard({ mosqueSlug }: { mosqueSlug: string }) {
  const kioskUrl = useMemo(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL ?? "";
    return `${origin}/give/${encodeURIComponent(mosqueSlug)}/kiosk`;
  }, [mosqueSlug]);

  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (e.g. non-HTTPS); the URL is still visible to
      // select manually.
    }
  }, [kioskUrl]);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-brand/10 text-brand">
            <TabletSmartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium text-dash-text">Self-service giving kiosk</p>
            <p className="mt-1 text-sm text-dash-muted">
              Open this public link full-screen on an iPad or tablet at the
              door. Members choose an amount, add Gift Aid, and pay on their
              own phone via QR. The screen stays awake until you tap Sleep.
            </p>
            <p className="mt-2 break-all rounded-md bg-dash-surface-subtle px-2.5 py-1.5 font-mono text-xs text-dash-muted">
              {kioskUrl}
            </p>
          </div>
        </div>
        <div className="flex flex-none gap-2 sm:flex-col">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button asChild size="sm">
            <a href={kioskUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Open kiosk
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
