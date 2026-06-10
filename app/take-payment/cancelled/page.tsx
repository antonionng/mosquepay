// /take-payment/cancelled?payment_id=tip_...
//
// Public landing page the cardholder is sent to when they close the Mooov
// hosted page without completing the payment. No auth required (the payer
// isn't an admin), intentionally outside /admin/ so the auth proxy doesn't
// redirect them to admin-login.
//
// We do not retry on this page — the treasurer will see the open QR session
// expire on their iPad/phone and can mint a new one if needed. We just want
// the cardholder to land on a friendly "no worries" page instead of a 404.

import { XCircle } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function TakePaymentCancelledPage() {
  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-10 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-md flex-col items-stretch gap-6">
        <div className="rounded-3xl bg-white p-8 text-center shadow-md">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-600">
            <XCircle className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Payment cancelled
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            No worries — nothing was charged. If this was a mistake, ask the
            treasurer to show you the QR again.
          </p>
          <p className="mt-6 text-xs text-slate-400">You can safely close this page.</p>
        </div>

        <p className="text-center text-xs text-slate-400">
          Powered by{" "}
          <Link href="/" className="font-medium text-slate-500 hover:text-slate-700">
            ChurchPay
          </Link>
        </p>
      </div>
    </main>
  );
}
