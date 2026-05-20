"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminLodgeSwitcher } from "@/components/layout/admin-lodge-switcher";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { RoleTour } from "@/components/onboarding/role-tour";
import { cn } from "@/lib/utils";

type HeaderParent = { label: string; href: string };

function adminHeaderMeta(pathname: string): { title: string; parent?: HeaderParent } {
  if (pathname === "/admin") return { title: "Dashboard" };
  if (pathname.startsWith("/admin/leads/kanban"))
    return { title: "Pipeline Board", parent: { label: "Candidates", href: "/admin/leads" } };
  if (pathname === "/admin/leads/new")
    return { title: "New candidate", parent: { label: "Candidates", href: "/admin/leads" } };
  if (pathname.startsWith("/admin/leads/"))
    return { title: "Candidate", parent: { label: "Candidates", href: "/admin/leads" } };
  if (pathname === "/admin/leads") return { title: "Candidate Pipeline" };
  if (pathname.startsWith("/admin/members/"))
    return { title: "Member", parent: { label: "Members", href: "/admin/members" } };
  if (pathname.startsWith("/admin/members")) return { title: "Members" };
  if (pathname === "/admin/events/new")
    return { title: "New calendar item", parent: { label: "Meetings", href: "/admin/meetings" } };
  if (pathname.startsWith("/admin/events/"))
    return { title: "Calendar item", parent: { label: "Meetings", href: "/admin/meetings" } };
  if (pathname.startsWith("/admin/events")) return { title: "Calendar", parent: { label: "Meetings", href: "/admin/meetings" } };
  if (pathname.startsWith("/admin/meetings")) return { title: "Meetings" };
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
  if (pathname.startsWith("/admin/almoner/cases/")) {
    return { title: "Welfare Case", parent: { label: "Almoner", href: "/admin/almoner" } };
  }
  if (pathname.startsWith("/admin/almoner")) return { title: "Almoner" };
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
  if (pathname.startsWith("/admin/provinces/")) {
    return { title: "Province", parent: { label: "Provinces", href: "/admin/provinces" } };
  }
  if (pathname.startsWith("/admin/provinces")) return { title: "Provinces" };
  if (pathname.startsWith("/admin/settings")) return { title: "Settings" };
  return { title: "Admin" };
}

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/admin/login" || pathname === "/admin/accept-invite";

  if (isAuthPage) {
    return <>{children}</>;
  }

  const { title, parent } = adminHeaderMeta(pathname);

  return (
    <div className="admin-dashboard-light flex min-h-screen bg-dash-surface text-dash-text">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:border focus:border-dash-border focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-dash-text focus:shadow-md"
      >
        Skip to main content
      </a>
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <ImpersonationBanner />
        <header
          className={cn(
            "sticky top-0 z-20 border-b border-dash-border bg-dash-surface/95 backdrop-blur-md",
            "supports-[backdrop-filter]:bg-dash-surface/80"
          )}
        >
          <div className="flex h-16 items-center justify-between gap-4 px-4 pl-[3.25rem] lg:h-[4.5rem] lg:pl-6 lg:pr-8">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="min-w-0 flex-1">
                {parent ? (
                  <nav
                    className="mb-0.5 flex flex-wrap items-center gap-1.5 text-xs text-dash-muted"
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
                  <p className="mb-0.5 text-xs font-medium uppercase tracking-[0.14em] text-dash-faint">
                    Lodge admin
                  </p>
                )}
                <h1 className="truncate text-lg font-semibold tracking-tight text-dash-text lg:text-xl">
                  {title}
                </h1>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <AdminLodgeSwitcher />
            </div>
          </div>
        </header>

        <main
          id="admin-main"
          tabIndex={-1}
          className="flex-1 overflow-auto bg-dash-surface p-4 outline-none sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
      <RoleTour />
    </div>
  );
}
