import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking confirmed",
  robots: { index: false, follow: false },
};

export default function GuestInvitationSuccess() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">
          You&apos;re confirmed
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Thank you. A welcome email is on its way with everything you need to
          know about the event. We look forward to seeing you.
        </p>
      </div>
    </main>
  );
}
