import Image from "next/image";
import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function MemberSignupPage() {
  return (
    <div className="admin-dashboard-light flex min-h-screen items-center justify-center bg-dash-bg px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/brand/churchpay-admin-signin.png"
            alt="ChurchPay"
            width={1200}
            height={800}
            priority
            className="mb-6 h-36 w-36 object-contain"
          />
          <h1 className="text-3xl font-semibold tracking-tight text-dash-text">
            Member access is invite only
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-dash-muted">
            ChurchPay member accounts are created by church officers. If you have been invited,
            use the link in your email to activate your member portal.
          </p>
        </div>

        <div className="admin-surface p-8">
          <div className="flex items-start gap-3 rounded-xl border border-[hsl(var(--dash-ring)/0.25)] bg-[hsl(var(--dash-ring)/0.06)] px-4 py-4 text-sm text-[hsl(var(--dash-ring-dark))]">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Check your invite email</p>
              <p className="mt-1 leading-relaxed">
                Your Secretary, Membership Officer, or church admin can send you a secure invite.
                Public self-registration is not enabled.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <Link
              href="/member/login"
              className="inline-flex items-center justify-center rounded-lg bg-dash-ring px-5 py-3 text-sm font-semibold text-white shadow-dash transition-colors hover:bg-dash-ring-dark"
            >
              Back to member login
            </Link>
            <Link
              href="/contact#contact-form"
              className="inline-flex items-center justify-center rounded-lg border border-dash-border-strong bg-white px-5 py-3 text-sm font-semibold text-dash-text shadow-sm transition-colors hover:bg-dash-surface-subtle"
            >
              Contact ChurchPay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
