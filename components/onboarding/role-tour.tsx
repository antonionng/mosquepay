"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  GraduationCap,
  Heart,
  HeartHandshake,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/telemetry";
import type { LucideIcon } from "lucide-react";

type Role =
  | "super_admin"
  | "operator"
  | "secretary"
  | "treasurer"
  | "pastoral_care"
  | "charity_steward"
  | "membership_officer";

type TourStep = {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const TOURS: Record<Role, { greeting: string; steps: TourStep[] } | null> = {
  super_admin: {
    greeting: "Welcome. As a super admin you can run every part of the platform.",
    steps: [
      {
        icon: Sparkles,
        title: "Finish onboarding",
        description: "Run the 15-minute setup to import members, giving, and your first notice.",
        href: "/admin/onboarding",
        cta: "Open onboarding",
      },
      {
        icon: ShieldCheck,
        title: "Compliance & MFA",
        description: "Set data retention rules and enable two-factor auth.",
        href: "/admin/compliance",
        cta: "Open compliance",
      },
      {
        icon: Wallet,
        title: "Treasurer ledger",
        description: "Single source of truth across payments, giving, and donations.",
        href: "/admin/treasurer",
        cta: "Open treasurer",
      },
    ],
  },
  operator: {
    greeting: "Welcome. As an operator you have platform-wide access across churches.",
    steps: [
      {
        icon: Sparkles,
        title: "Onboarding wizard",
        description: "Walk a new church through the 15-minute setup.",
        href: "/admin/onboarding",
        cta: "Open onboarding",
      },
      {
        icon: ShieldCheck,
        title: "Compliance & MFA",
        description: "Configure retention and require two-factor auth on staff accounts.",
        href: "/admin/compliance",
        cta: "Open compliance",
      },
    ],
  },
  secretary: {
    greeting: "Welcome, Secretary. Here are the three places you'll live in most days.",
    steps: [
      {
        icon: Calendar,
        title: "Schedule services",
        description: "Add the next regular service, fellowship meal, or special_service.",
        href: "/admin/services",
        cta: "Open services",
      },
      {
        icon: Users,
        title: "Members register",
        description: "Maintain the roll book, addresses, dietary requirements, and discipleships.",
        href: "/admin/members",
        cta: "Open members",
      },
      {
        icon: Megaphone,
        title: "Communications",
        description: "Send notice, newsletters, and run automations like birthday greetings.",
        href: "/admin/communications",
        cta: "Open communications",
      },
    ],
  },
  treasurer: {
    greeting: "Welcome, Treasurer. Your day-to-day lives in the ledger and reconciliation tools.",
    steps: [
      {
        icon: Wallet,
        title: "Treasurer ledger",
        description: "See payments, giving, donations and refunds in one place.",
        href: "/admin/treasurer",
        cta: "Open treasurer",
      },
      {
        icon: Wallet,
        title: "Bank reconciliation",
        description: "Upload a CSV statement and match against admin-recorded payments.",
        href: "/admin/treasurer/reconciliation",
        cta: "Open reconciliation",
      },
    ],
  },
  pastoral_care: {
    greeting: "Welcome, PastoralCare. The PastoralCare module helps you stay close to members in need.",
    steps: [
      {
        icon: HeartHandshake,
        title: "PastoralCare cases",
        description: "Open cases, log visits, and keep the bereavement register up to date.",
        href: "/admin/pastoral_care",
        cta: "Open pastoral_care",
      },
      {
        icon: Users,
        title: "Members directory",
        description: "Look up addresses, dates, and family contacts for any member.",
        href: "/admin/members",
        cta: "Open members",
      },
    ],
  },
  charity_steward: {
    greeting: "Welcome, Charity Steward. Run campaigns, capture Gift Aid, and track totals.",
    steps: [
      {
        icon: Heart,
        title: "Charity campaigns",
        description: "Create and manage charitable campaigns and their suggested amounts.",
        href: "/admin/charity",
        cta: "Open charity",
      },
      {
        icon: Heart,
        title: "Donations",
        description: "Record donations, attach Gift Aid declarations, and reconcile totals.",
        href: "/admin/donations",
        cta: "Open donations",
      },
    ],
  },
  membership_officer: {
    greeting: "Welcome, Membership Officer. Manage newcomers, members, and discipleship.",
    steps: [
      {
        icon: Users,
        title: "Newcomers pipeline",
        description: "Move newcomers from enquiry through interview to membership.",
        href: "/admin/newcomers",
        cta: "Open newcomers",
      },
      {
        icon: Users,
        title: "Members register",
        description: "Maintain the roll book and member lifecycle.",
        href: "/admin/members",
        cta: "Open members",
      },
      {
        icon: GraduationCap,
        title: "Mentoring",
        description: "Assign mentors and track discipleship through the discipleship steps.",
        href: "/admin/mentoring",
        cta: "Open mentoring",
      },
    ],
  },
};

function storageKey(role: Role) {
  return `church.tour.dismissed.${role}`;
}

export function RoleTour() {
  const [role, setRole] = useState<Role | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        const detectedRole: Role | undefined = data?.admin?.role;
        if (!detectedRole) return;
        const dismissed =
          typeof window !== "undefined" &&
          window.localStorage.getItem(storageKey(detectedRole)) === "1";
        if (dismissed) return;
        if (!TOURS[detectedRole]) return;
        setRole(detectedRole);
        setOpen(true);
        trackEvent("tour.shown", { role: detectedRole });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function dismiss() {
    if (role && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(role), "1");
    }
    if (role) trackEvent("tour.dismissed", { role, step });
    setOpen(false);
  }

  if (!open || !role) return null;
  const tour = TOURS[role];
  if (!tour) return null;

  const currentStep = tour.steps[step];
  const isLast = step === tour.steps.length - 1;
  const StepIcon = currentStep.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tour-title"
      className="fixed inset-0 z-50 flex items-end justify-end p-3 sm:p-6"
    >
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]"
        onClick={dismiss}
        aria-hidden
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" aria-hidden />
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quick tour · Step {step + 1} of {tour.steps.length}
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss tour"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">
          {step === 0 && (
            <p className="mb-3 text-sm text-slate-500">{tour.greeting}</p>
          )}
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <StepIcon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 id="tour-title" className="text-sm font-semibold text-slate-900">
                {currentStep.title}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {currentStep.description}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Link
              href={currentStep.href}
              onClick={() => trackEvent("tour.cta", { role, step })}
            >
              <Button size="sm" variant="outline">
                {currentStep.cta} <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  Back
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={dismiss}>
                  Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => setStep((s) => Math.min(tour.steps.length - 1, s + 1))}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 text-right">
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-slate-500 underline-offset-2 hover:underline"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
