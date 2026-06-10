import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { getCurrentAdminScope } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/supabase/server";
import * as db from "@/lib/db";
import { TakePaymentClient } from "./take-payment-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Banknote } from "lucide-react";

export const dynamic = "force-dynamic";

// Point this route at its own PWA manifest so admins can install "ChurchPay
// POS" as a standalone app from /admin/take-payment without it being
// confused with the member portal manifest (which scopes to /member).
export const metadata: Metadata = {
  title: "Take payment",
  manifest: "/manifest-pos.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ChurchPay POS",
  },
};

const RETURN_PATH = "/admin/take-payment";

type SearchParams = Record<string, string | string[] | undefined>;

function buildReturnPath(params: SearchParams): string {
  // Preserve the tab + focus query string through the login redirect so
  // a bookmarked link like /admin/take-payment?tab=cash actually lands
  // on the Cash tab post-login, not on the default Charge tab.
  const pick = (key: string) => {
    const value = params[key];
    if (typeof value === "string" && value) return value;
    if (Array.isArray(value) && value[0]) return value[0];
    return null;
  };
  const allowed: Array<[string, string]> = [];
  const tab = pick("tab");
  if (tab) allowed.push(["tab", tab]);
  const focus = pick("focus");
  if (focus) allowed.push(["focus", focus]);
  const eventId = pick("event_id");
  if (eventId) allowed.push(["event_id", eventId]);
  const category = pick("category");
  if (category) allowed.push(["category", category]);
  if (allowed.length === 0) return RETURN_PATH;
  const search = new URLSearchParams(allowed).toString();
  return `${RETURN_PATH}?${search}`;
}

async function getMooovConnection(churchId: string) {
  try {
    const { data } = await createServiceClient()
      .schema("mooov")
      .from("churches")
      .select("merchant_id,status")
      .eq("id", churchId)
      .maybeSingle<{ merchant_id: string; status: string }>();
    return data;
  } catch {
    return null;
  }
}

async function getChurchMembers(churchId: string) {
  // Light-weight list for the in-form picker. We deliberately fetch all
  // active members in one go (churches are small — typically <100 members) so
  // the client can run the filter locally without a debounced API round-trip
  // mid-service on flaky venue Wi-Fi.
  try {
    const members = await db.getMembers(churchId, { status: "active" });
    return members.map((m) => ({
      id: m.id,
      full_name: m.full_name,
      email: m.email ?? null,
    }));
  } catch {
    return [];
  }
}

/**
 * Events for the optional "Link to service" picker on the take-payment
 * form. We include every upcoming service (no forward horizon — secretaries
 * routinely schedule special_services 6-12 months out) plus a 90-day back-tail
 * for treasurers reconciling cash a few weeks after the night, then cap to
 * the 20 closest entries to "now" so the dropdown stays scannable on a
 * phone. Older services can still be attached retroactively from the
 * payment detail page.
 */
async function getChurchEventsForPicker(churchId: string) {
  try {
    const events = await db.getEvents(churchId);
    const now = Date.now();
    const horizonBackMs = 90 * 24 * 60 * 60 * 1000;
    return events
      .filter((event) => {
        const ts = new Date(event.event_date).getTime();
        if (!Number.isFinite(ts)) return false;
        if (ts < now - horizonBackMs) return false;
        return true;
      })
      .sort((a, b) => {
        // Prefer the closest event to "now" first so the next upcoming
        // service tops the list, and recent past services follow.
        const aDist = Math.abs(new Date(a.event_date).getTime() - now);
        const bDist = Math.abs(new Date(b.event_date).getTime() - now);
        return aDist - bDist;
      })
      .slice(0, 20)
      .map((event) => ({
        id: event.id,
        title: event.title,
        event_date: event.event_date,
      }));
  } catch {
    return [];
  }
}

export default async function TakePaymentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Custom auth gate so an unauthenticated newcomer lands BACK here after
  // logging in. The shared getAdminReadContext redirects to /admin/login
  // without a return URL, which is fine for nav-tab landings but defeats
  // the "bookmark this page on your phone home screen" use case the take-
  // payment route is built around.
  const params = await searchParams;
  const scope = await getCurrentAdminScope();
  if (scope.kind === "none") {
    const returnTo = buildReturnPath(params);
    redirect(`/admin/login?from=${encodeURIComponent(returnTo)}`);
  }

  const ctx = await getAdminReadContext();
  if (ctx.mode !== "database" || !ctx.churchId) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="admin-page-head">
          <div>
            <h1 className="admin-page-title">Take payment</h1>
            <p className="admin-page-copy">
              In-person QR payments for ad-hoc charity, raffle, and dining
              top-ups.
            </p>
          </div>
        </div>
        <EmptyState
          icon={Banknote}
          title="Take payment needs a live church"
          description="Connect Supabase and choose a church to use the in-person QR flow. Demo mode does not mint live payment sessions."
        />
      </div>
    );
  }

  const [connection, members, events] = await Promise.all([
    getMooovConnection(ctx.churchId),
    getChurchMembers(ctx.churchId),
    getChurchEventsForPicker(ctx.churchId),
  ]);
  const connected = !!connection && connection.status === "active";

  return (
    <TakePaymentClient
      connected={connected}
      mooovStatus={connection?.status ?? null}
      members={members}
      events={events}
      churchSlug={ctx.churchSlug ?? null}
    />
  );
}
