// /give/<slug>/done?payment_id=...
//
// Landed here after Mooov captures the standing-QR payment. We don't try to
// gate on the webhook (it might race the redirect by a second or two); we
// just show a "Thanks, the church will receive your gift" page. The Treasurer
// gets the official audit trail via the Mooov webhook and the projection
// into public.payments.

import { Heart } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GiveDonePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <Heart className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Thank you.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Your gift has been received. You&apos;ll get a receipt by email
          shortly. The church thanks you for your support.
        </p>
        <p className="mt-6 text-xs text-slate-400">{slug}</p>
      </div>
    </main>
  );
}
