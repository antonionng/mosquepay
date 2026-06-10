"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_REOPEN_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from "@/lib/cookie-consent";

type ConsentSnapshot = CookieConsentValue | "unset";

function getConsentSnapshot(): ConsentSnapshot {
  return getCookieConsent() ?? "unset";
}

function subscribeToConsent(callback: () => void) {
  window.addEventListener(COOKIE_CONSENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(COOKIE_CONSENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => "accepted");
  const [forceOpen, setForceOpen] = useState(false);

  useEffect(() => {
    const reopen = () => setForceOpen(true);
    const handleDocumentClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-cookie-settings]")) return;
      event.preventDefault();
      reopen();
    };

    window.addEventListener(COOKIE_CONSENT_REOPEN_EVENT, reopen);
    document.addEventListener("click", handleDocumentClick);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_REOPEN_EVENT, reopen);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  function choose(value: CookieConsentValue) {
    setCookieConsent(value);
    setForceOpen(false);
  }

  const visible = forceOpen || consent === "unset";

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[200] border-t border-dash-border bg-white/95 px-4 py-4 text-dash-text shadow-[0_-18px_40px_-24px_rgba(15,23,42,0.45)] backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-dash-text">Cookies on ChurchPay</p>
          <p className="mt-1 text-sm leading-relaxed text-dash-muted">
            We use strictly necessary cookies to run login, security, and account features.
            With your consent, we also use analytics cookies to understand page views and
            improve the service. You can accept or decline analytics cookies.
          </p>
          <Link href="/cookies" className="mt-2 inline-flex text-sm font-semibold text-dash-ring hover:underline">
            Read our Cookie Policy
          </Link>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => choose("declined")}
            className="inline-flex items-center justify-center rounded-lg border border-dash-border-strong bg-white px-5 py-2.5 text-sm font-semibold text-dash-text shadow-sm transition-colors hover:bg-dash-surface-subtle"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => choose("accepted")}
            className="inline-flex items-center justify-center rounded-lg border border-dash-ring bg-dash-ring px-5 py-2.5 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
