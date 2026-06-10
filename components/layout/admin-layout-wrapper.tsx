"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminChurchSwitcher } from "@/components/layout/admin-church-switcher";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { RoleTour } from "@/components/onboarding/role-tour";
import { cn } from "@/lib/utils";

type HeaderParent = { label: string; href: string };

function adminHeaderMeta(pathname: string): { title: string; parent?: HeaderParent } {
  if (pathname === "/admin") return { title: "Dashboard" };
  if (pathname.startsWith("/admin/newcomers/kanban"))
    return { title: "Pipeline Board", parent: { label: "Newcomers", href: "/admin/newcomers" } };
  if (pathname === "/admin/newcomers/new")
    return { title: "New newcomer", parent: { label: "Newcomers", href: "/admin/newcomers" } };
  if (pathname.startsWith("/admin/newcomers/"))
    return { title: "Newcomer", parent: { label: "Newcomers", href: "/admin/newcomers" } };
  if (pathname === "/admin/newcomers") return { title: "Newcomer Pipeline" };
  if (pathname.startsWith("/admin/members/"))
    return { title: "Member", parent: { label: "Members", href: "/admin/members" } };
  if (pathname.startsWith("/admin/members")) return { title: "Members" };
  if (pathname === "/admin/events/new")
    return { title: "New calendar item", parent: { label: "Services", href: "/admin/services" } };
  if (pathname.startsWith("/admin/events/"))
    return { title: "Calendar item", parent: { label: "Services", href: "/admin/services" } };
  if (pathname.startsWith("/admin/events")) return { title: "Calendar", parent: { label: "Services", href: "/admin/services" } };
  if (pathname.startsWith("/admin/services")) return { title: "Services" };
  if (pathname === "/admin/blog/new")
    return { title: "New post", parent: { label: "Website", href: "/admin/website" } };
  if (pathname.startsWith("/admin/blog/"))
    return { title: "Blog post", parent: { label: "Website", href: "/admin/website" } };
  if (pathname.startsWith("/admin/blog")) return { title: "Blog", parent: { label: "Website", href: "/admin/website" } };
  if (pathname.startsWith("/admin/website")) return { title: "Website" };
  if (pathname.startsWith("/admin/payments/")) {
    return { title: "Payment", parent: { label: "Payments", href: "/admin/payments" } };
  }
  if (pathname.startsWith("/admin/payments")) return { title: "Payments" };
  if (pathname === "/admin/treasurer/reconciliation") {
    return {
      title: "Bank Reconciliation",
      parent: { label: "Treasurer", href: "/admin/treasurer" },
    };
  }
  if (pathname.startsWith("/admin/treasurer")) return { title: "Treasurer" };
  if (pathname.startsWith("/admin/charity/")) {
    return { title: "Charity Campaign", parent: { label: "Charity", href: "/admin/charity" } };
  }
  if (pathname.startsWith("/admin/charity")) return { title: "Charity" };
  if (pathname === "/admin/donations/new") {
    return { title: "Add Donation", parent: { label: "Donations", href: "/admin/donations" } };
  }
  if (pathname.startsWith("/admin/donations/")) {
    return { title: "Donation", parent: { label: "Donations", href: "/admin/donations" } };
  }
  if (pathname.startsWith("/admin/donations")) return { title: "Donations" };
  if (pathname.startsWith("/admin/gift-aid/")) {
    return { title: "Gift Aid Declaration", parent: { label: "Gift Aid", href: "/admin/gift-aid" } };
  }
  if (pathname.startsWith("/admin/gift-aid")) return { title: "Gift Aid" };
  if (pathname.startsWith("/admin/pastoral_care/cases/")) {
    return { title: "PastoralCare Case", parent: { label: "PastoralCare", href: "/admin/pastoral_care" } };
  }
  if (pathname.startsWith("/admin/pastoral_care")) return { title: "PastoralCare" };
  if (pathname.startsWith("/admin/communications")) return { title: "Communications" };
  if (pathname.startsWith("/admin/templates"))
    return { title: "Template library", parent: { label: "Communications", href: "/admin/communications" } };
  if (pathname.startsWith("/admin/mentoring")) return { title: "Mentoring" };
  if (pathname.startsWith("/admin/reports")) return { title: "Reports" };
  if (pathname.startsWith("/admin/audit-compliance")) return { title: "Audit & Compliance" };
  if (pathname.startsWith("/admin/audit"))
    return { title: "Audit Trail", parent: { label: "Audit & Compliance", href: "/admin/audit-compliance" } };
  if (pathname.startsWith("/admin/compliance"))
    return { title: "Compliance", parent: { label: "Audit & Compliance", href: "/admin/audit-compliance" } };
  if (pathname.startsWith("/admin/platform")) return { title: "Platform overview" };
  if (pathname.startsWith("/admin/networks/")) {
    return { title: "Network", parent: { label: "Networks", href: "/admin/networks" } };
  }
  if (pathname.startsWith("/admin/networks")) return { title: "Networks" };
  if (pathname.startsWith("/admin/settings")) return { title: "Settings" };
  return { title: "Admin" };
}

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage =
    pathname === "/admin/login" ||
    pathname === "/admin/signin" ||
    pathname === "/admin/accept-invite" ||
    pathname === "/admin/forgot-password" ||
    pathname === "/admin/reset-password";

  // Routes that should run as a kiosk on phones: full-bleed, no admin
  // header/breadcrumb chrome eating vertical space. We keep the sidebar
  // hamburger reachable so the user can still navigate, but on a phone
  // every other LP admin pixel is hidden so the QR / keypad owns the
  // viewport. Desktop view is unaffected (CSS re-shows the header at lg).
  const isKioskRoute = pathname === "/admin/take-payment";

  // Lock <html>/<body> scroll on kiosk routes so the page feels like a
  // native app: only the inner <main> scrolls, no rubber-band bounce on
  // iOS, no accidental zoom-and-pan. Desktop is unaffected because the
  // tablet/laptop kiosk view doesn't need it.
  //
  // NB: the effect must live ABOVE the auth-page early return so the hook
  // order stays stable across all paths (React's rules-of-hooks).
  useEffect(() => {
    if (!isKioskRoute) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevTouch = (body.style as CSSStyleDeclaration).overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      body.style.overscrollBehavior = prevTouch;
    };
  }, [isKioskRoute]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  const { title, parent } = adminHeaderMeta(pathname);

  return (
    <div
      className={cn(
        "admin-dashboard-light flex bg-dash-surface text-dash-text",
        isKioskRoute ? "h-dvh min-h-0 overflow-hidden" : "min-h-screen",
      )}
      data-admin-route={isKioskRoute ? "kiosk" : "default"}
    >
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:border focus:border-dash-border focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-dash-text focus:shadow-md"
      >
        Skip to main content
      </a>
      <AdminSidebar />
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          isKioskRoute ? "h-dvh min-h-0" : "min-h-screen",
        )}
      >
        <ImpersonationBanner />
        <header
          data-admin-chrome="true"
          className={cn(
            "sticky top-0 z-20 border-b border-dash-border bg-dash-surface/95 backdrop-blur-md",
            "supports-[backdrop-filter]:bg-dash-surface/80"
          )}
        >
          <div
            className={cn(
              "flex h-14 items-center justify-between gap-3 px-4 pl-[3.25rem] sm:h-16 lg:h-[4.5rem] lg:pl-6 lg:pr-8",
              "pt-[env(safe-area-inset-top)] h-[calc(3.5rem+env(safe-area-inset-top))] sm:h-[calc(4rem+env(safe-area-inset-top))] lg:h-[calc(4.5rem+env(safe-area-inset-top))]"
            )}
          >
            {/* Back button on phone when we have a parent route; replaces
                the breadcrumb (which is unreadable on phone and steals a
                row of vertical space). At sm+ we restore the breadcrumb. */}
            {parent && (
              <button
                type="button"
                onClick={() => router.push(parent.href)}
                aria-label={`Back to ${parent.label}`}
                className="-ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dash-text transition-colors hover:bg-dash-surface-subtle sm:hidden"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="min-w-0 flex-1">
                {parent ? (
                  <nav
                    className="mb-0.5 hidden flex-wrap items-center gap-1.5 text-xs text-dash-muted sm:flex"
                    aria-label="Breadcrumb"
                  >
                    <Link
                      href="/admin"
                      className="font-medium text-dash-faint transition-colors hover:text-dash-text"
                    >
                      Admin
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-dash-faint" aria-hidden />
                    <Link
                      href={parent.href}
                      className="truncate font-medium text-dash-faint transition-colors hover:text-dash-text"
                    >
                      {parent.label}
                    </Link>
                  </nav>
                ) : (
                  <p className="mb-0.5 hidden text-xs font-medium uppercase tracking-[0.14em] text-dash-faint sm:block">
                    Church admin
                  </p>
                )}
                <h1 className="truncate text-base font-semibold tracking-tight text-dash-text sm:text-lg lg:text-xl">
                  {title}
                </h1>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <AdminChurchSwitcher />
            </div>
          </div>
        </header>

        <main
          id="admin-main"
          data-admin-main="true"
          tabIndex={-1}
          className={cn(
            "flex-1 overflow-auto bg-dash-surface p-4 outline-none sm:p-6 lg:p-8",
            // On kiosk routes the inner main is the only scrollable region.
            // overscroll-behavior:contain stops iOS rubber-banding past the
            // edges from dragging the church header chrome on or off-screen.
            isKioskRoute && "overscroll-contain",
          )}
        >
          {children}
        </main>
      </div>
      <RoleTour />
    </div>
  );
}
