// /give/<slug>/cancelled
//
// Landed here when the donor closed the Mooov page without completing a
// payment. We send them back to the amount-selection page (default to the
// charity context) with a friendly "no worries" note.

import Link from "next/link";
import { XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function GiveCancelledPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <main className="min-h-screen bg-slate-50 py-16 px-4">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-md text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-600">
          <XCircle className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">
          Payment cancelled
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          No worries — nothing was charged. You can try again any time.
        </p>
        <div className="mt-6">
          <Link
            href={`/give/${encodeURIComponent(slug)}/charity`}
            className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Try again
          </Link>
        </div>
      </div>
    </main>
  );
}
