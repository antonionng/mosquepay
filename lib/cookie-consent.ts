export type CookieConsentValue = "accepted" | "declined";

export const COOKIE_CONSENT_KEY = "lp_cookie_consent";
export const COOKIE_CONSENT_EVENT = "lp-cookie-consent-change";
export const COOKIE_CONSENT_REOPEN_EVENT = "lp-cookie-consent-reopen";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function safeDocument(): Document | null {
  if (typeof document === "undefined") return null;
  return document;
}

function safeWindow(): Window | null {
  if (typeof window === "undefined") return null;
  return window;
}

function parseConsent(value: string | null | undefined): CookieConsentValue | null {
  return value === "accepted" || value === "declined" ? value : null;
}

function readCookie(): CookieConsentValue | null {
  const doc = safeDocument();
  if (!doc) return null;
  const match = doc.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_CONSENT_KEY}=`));
  return parseConsent(match?.split("=")[1]);
}

export function getCookieConsent(): CookieConsentValue | null {
  try {
    const stored = parseConsent(safeWindow()?.localStorage.getItem(COOKIE_CONSENT_KEY));
    return stored ?? readCookie();
  } catch {
    return readCookie();
  }
}

export function setCookieConsent(value: CookieConsentValue): void {
  const doc = safeDocument();
  const win = safeWindow();

  if (doc) {
    doc.cookie = `${COOKIE_CONSENT_KEY}=${value}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
  }

  try {
    win?.localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    // localStorage can be blocked. The cookie still records the choice.
  }

  win?.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: value }));
}

export function reopenCookieConsent(): void {
  safeWindow()?.dispatchEvent(new Event(COOKIE_CONSENT_REOPEN_EVENT));
}
