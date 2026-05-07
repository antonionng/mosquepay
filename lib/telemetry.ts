/**
 * Lightweight client-side telemetry. No-op in tests / SSR.
 *
 * Wires:
 *  - console.debug for local dev
 *  - window.dataLayer push if present (Google / Plausible / GTM-compatible)
 *  - Vercel Analytics `va` global if present
 *
 * Usage:
 *   trackEvent("dues.bulk_run", { count: 42 });
 *   trackPageView(pathname);
 */

type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    va?: (event: "event", payload: { name: string; data?: EventProps }) => void;
  }
}

function safeWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window;
}

export function trackEvent(name: string, props: EventProps = {}): void {
  const w = safeWindow();
  if (!w) return;
  try {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[telemetry] event", name, props);
    }
    w.dataLayer?.push({ event: name, ...props });
    w.va?.("event", { name, data: props });
  } catch {
    // Telemetry must never throw.
  }
}

export function trackPageView(pathname: string, props: EventProps = {}): void {
  trackEvent("page_view", { pathname, ...props });
}
