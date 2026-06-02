import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { marketingMetadata } from "@/lib/seo";

export const metadata: Metadata = marketingMetadata({
  title: "Log in to LodgePay | Member and Admin Access",
  description:
    "Choose the right LodgePay login route for your member portal, officer dashboard, or lodge administration tools.",
  path: "/login",
  keywords: ["LodgePay login", "Masonic member portal login", "lodge admin login"],
});

const routes = [
  {
    title: "Member login",
    description:
      "For brethren and lodge members responding to summons, viewing meetings, paying dues, giving to charity, and keeping receipts.",
    href: "/member/login",
    cta: "Open member portal",
    Icon: UserRound,
  },
  {
    title: "Officer and admin login",
    description:
      "For Secretaries, Treasurers, Charity Stewards, Almoners, Membership teams, Province users, and platform admins.",
    href: "/admin/login",
    cta: "Open admin dashboard",
    Icon: ShieldCheck,
  },
];

export default function LoginChooserPage() {
  return (
    <div className="bg-dash-bg text-dash-text">
      <section className="border-b border-dash-border bg-dash-surface pt-28">
        <div className="mx-auto max-w-6xl px-5 pb-16 pt-10 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dash-ring">
            LodgePay access
          </p>
          <h1 className="mt-4 max-w-4xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-dash-text sm:text-5xl lg:text-6xl">
            Choose the right login for your role.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-dash-muted sm:text-lg">
            Members and officers use different doors into LodgePay. Pick the route that matches
            how you serve the lodge.
          </p>
        </div>
      </section>

      <section className="border-b border-dash-border bg-dash-surface py-16 lg:py-24">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 lg:grid-cols-2 lg:px-8">
          {routes.map(({ title, description, href, cta, Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-[1.5rem] border border-dash-border bg-dash-surface p-8 shadow-dash transition hover:-translate-y-0.5 hover:border-dash-ring/40 hover:shadow-dash-raised"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-dash-ring/10 text-dash-ring">
                <Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-8 font-heading text-2xl font-semibold tracking-tight text-dash-text">
                {title}
              </h2>
              <p className="mt-4 text-base leading-relaxed text-dash-muted">{description}</p>
              <span className="mt-8 inline-flex items-center gap-2 rounded-lg bg-dash-ring px-5 py-3 text-sm font-semibold text-white transition-colors group-hover:bg-dash-ring-dark">
                {cta}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
