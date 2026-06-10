// /give/<slug>/kiosk
//
// Public self-service giving kiosk. Churches open this URL full-screen on an
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
  const church = await loadChurch(slug);

  if (!church) {
    return (
      <KioskShellMessage
        title="We couldn't find this church."
        body="Please check the kiosk link, or ask the church team to re-open it from the admin dashboard."
      />
    );
  }

  const connected = await isMerchantConnected(church.id);
  if (!connected) {
    return (
      <KioskShellMessage
        title={`${church.name} isn't ready for kiosk giving yet.`}
        body="The church has not connected its payment processor. An admin can finish setup under Integrations."
      />
    );
  }

  return <KioskClient slug={church.slug} churchName={church.name} />;
}

async function loadChurch(slug: string) {
  try {
    const { data, error } = await createServiceClient()
      .from("churches")
      .select("id, slug, name")
      .eq("slug", slug.trim().toLowerCase())
      .eq("is_active", true)
      .maybeSingle<{ id: string; slug: string; name: string }>();
    if (error) {
      console.error("kiosk page: church lookup failed", {
        slug,
        message: error.message,
      });
      return null;
    }
    return data ?? null;
  } catch (err) {
    console.error("kiosk page: church lookup threw", {
      slug,
      message: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function isMerchantConnected(churchId: string): Promise<boolean> {
  try {
    const { data, error } = await createServiceClient()
      .schema("mooov")
      .from("churches")
      .select("merchant_id, status")
      .eq("id", churchId)
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
