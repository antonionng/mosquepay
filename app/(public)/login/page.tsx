import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import {
  MarketingShell,
  MarketingSection,
  MarketingKicker,
} from "@/components/marketing/marketing-shell";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = marketingMetadata({
  title: "Log in to MosquePay | Member and Admin Access",
  description:
    "Choose the right MosquePay login: the member portal for giving and services, or the admin dashboard for mosque staff, treasurers, and leadership teams.",
  path: "/login",
  keywords: ["MosquePay login", "mosque member portal login", "mosque admin login"],
});

const routes = [
  {
    title: "Member login",
    description:
      "For congregation members. Give online, view your giving history and Gift Aid status, RSVP to services and events, and keep your details up to date.",
    href: "/member/login",
    cta: "Open member portal",
    Icon: UserRound,
  },
  {
    title: "Staff and admin login",
    description:
      "For imams, administrators, treasurers, welcome teams, welfare leads, network users, and platform admins.",
    href: "/admin/login",
    cta: "Open admin dashboard",
    Icon: ShieldCheck,
  },
];

export default function LoginChooserPage() {
  return (
    <MarketingShell>
      <section className="px-5 pb-4 pt-16 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <MarketingKicker>MosquePay access</MarketingKicker>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Choose the right login for your role.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Members and mosque teams use different doors into MosquePay. Pick the one that
              matches how you serve.
            </p>
          </div>
        </div>
      </section>

      <MarketingSection>
        <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
          {routes.map(({ title, description, href, cta, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-3xl border border-[#e9e2d4] bg-white p-8 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_16px_40px_-16px_rgba(30,41,59,0.18)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/8 text-brand">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-7 font-heading text-2xl font-semibold tracking-tight text-slate-900">
                {title}
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
              <span className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors group-hover:bg-brand-dark">
                {cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </MarketingSection>
    </MarketingShell>
  );
}
