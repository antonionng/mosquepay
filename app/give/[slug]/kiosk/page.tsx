// /give/<slug>/kiosk
//
// Public self-service giving kiosk. Mosques open this URL full-screen on an
// iPad / tablet at the door; members walk up, choose an amount + purpose,
// optionally add their details and a digital Gift Aid declaration, then scan
// the generated QR with their own phone to pay via Apple Pay / Google Pay /
// card. The tablet never touches the card; it only shows the QR and waits
// for the webhook-confirmed result.
//
// The client component handles the step flow, status polling, idle reset,
// and a screen wake lock so the tablet stays awake until put to sleep.

import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/server";
import { KioskClient } from "./kiosk-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Giving Kiosk",
  robots: { index: false, follow: false },
};

export default async function KioskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mosque = await loadMosque(slug);

  if (!mosque) {
    return (
      <KioskShellMessage
        title="We couldn't find this mosque."
        body="Please check the kiosk link, or ask the mosque team to re-open it from the admin dashboard."
      />
    );
  }

  const connected = await isMerchantConnected(mosque.id);
  if (!connected) {
    return (
      <KioskShellMessage
        title={`${mosque.name} isn't ready for kiosk giving yet.`}
        body="The mosque has not connected its payment processor. An admin can finish setup under Integrations."
      />
    );
  }

  return <KioskClient slug={mosque.slug} mosqueName={mosque.name} />;
}

async function loadMosque(slug: string) {
  try {
    const { data, error } = await createServiceClient()
      .from("mosques")
      .select("id, slug, name")
      .eq("slug", slug.trim().toLowerCase())
      .eq("is_active", true)
      .maybeSingle<{ id: string; slug: string; name: string }>();
    if (error) {
      console.error("kiosk page: mosque lookup failed", {
        slug,
        message: error.message,
      });
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("kiosk page: mosque lookup threw", {
      slug,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function isMerchantConnected(mosqueId: string): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient()
      .schema("mooov")
      .from("mosques")
      .select("merchant_id, status")
      .eq("id", mosqueId)
      .maybeSingle<{ merchant_id: string; status: string }>();
    if (error || !data) return false;
    if (data.status && data.status !== "active") return false;
    return Boolean(data.merchant_id);
  } catch {
    return false;
  }
}

function KioskShellMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#faf8f3] px-6">
      <div className="mx-auto max-w-lg rounded-3xl border border-[#e9e2d4] bg-white p-10 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-base text-slate-600">{body}</p>
      </div>
    </main>
  );
}
