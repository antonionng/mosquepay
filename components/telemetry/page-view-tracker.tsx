"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  COOKIE_CONSENT_EVENT,
  getCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";
import { trackPageView } from "@/lib/telemetry";

function getConsentSnapshot(): CookieConsentValue | null {
  return getCookieConsent();
}

function subscribeToConsent(callback: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function PageViewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => null);
  const hasAnalyticsConsent = consent === "accepted";

  useEffect(() => {
    if (!pathname || !hasAnalyticsConsent) return;
    const query = search?.toString();
    trackPageView(pathname, query ? { query } : {});
  }, [hasAnalyticsConsent, pathname, search]);

  return null;
}
