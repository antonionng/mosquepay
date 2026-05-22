"use client";

import { useEffect, useState } from "react";

export type ViewerStatus = "loading" | "guest" | "admin" | "member";

export interface ViewerSession {
  status: ViewerStatus;
  /** Where to send them when they click "Open dashboard" / "Open portal". */
  destination: string | null;
  /** Best-effort label for the CTA, e.g. "Open dashboard" / "Open portal". */
  label: string | null;
  /** Display email, when known. */
  email: string | null;
}

const GUEST: ViewerSession = {
  status: "guest",
  destination: null,
  label: null,
  email: null,
};

/**
 * Resolves the current viewer's session by hitting both auth endpoints in
 * parallel. We treat admin sessions as preferred (they get sent to /admin),
 * falling back to member portal sessions (sent to /member). Anything else is
 * a guest -- the marketing site should still show the login button to them.
 *
 * Pure client-side; safe to call from any client component. Failures are
 * swallowed and the viewer is treated as a guest, so the login CTA stays
 * visible if the auth API is briefly unavailable.
 */
export function useViewerSession(): ViewerSession {
  const [session, setSession] = useState<ViewerSession>({
    status: "loading",
    destination: null,
    label: null,
    email: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      try {
        const [adminRes, memberRes] = await Promise.all([
          fetch("/api/auth/session", { cache: "no-store" }).catch(() => null),
          fetch("/api/auth/member/session", { cache: "no-store" }).catch(
            () => null
          ),
        ]);

        if (cancelled) return;

        if (adminRes && adminRes.ok) {
          const data = await adminRes.json().catch(() => null);
          if (data && data.authenticated) {
            setSession({
              status: "admin",
              destination: "/admin",
              label: "Open dashboard",
              email:
                (data.admin && typeof data.admin.email === "string"
                  ? data.admin.email
                  : null) ?? null,
            });
            return;
          }
        }

        if (memberRes && memberRes.ok) {
          const data = await memberRes.json().catch(() => null);
          if (data && data.user) {
            setSession({
              status: "member",
              destination: "/member",
              label: "Open portal",
              email:
                typeof data.user.email === "string" ? data.user.email : null,
            });
            return;
          }
        }

        setSession(GUEST);
      } catch {
        if (!cancelled) setSession(GUEST);
      }
    }
    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}
