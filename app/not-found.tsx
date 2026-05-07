import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        404
      </p>
      <h1 className="text-2xl font-bold text-slate-900">
        We could not find that page
      </h1>
      <p className="max-w-md text-sm text-slate-500">
        The link may be out of date, or the page may have moved. Try the
        homepage or sign in to your portal.
      </p>
      <div className="mt-2 flex gap-2">
        <Link
          href="/"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Go home
        </Link>
        <Link
          href="/member"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Member portal
        </Link>
      </div>
    </main>
  );
}
