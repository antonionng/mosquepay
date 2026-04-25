"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { cn } from "@/lib/utils";

type HeaderParent = { label: string; href: string };

function adminHeaderMeta(pathname: string): { title: string; parent?: HeaderParent } {
  if (pathname === "/admin") return { title: "Dashboard" };
  if (pathname.startsWith("/admin/leads/kanban"))
    return { title: "Pipeline Board", parent: { label: "Leads", href: "/admin/leads" } };
  if (pathname.startsWith("/admin/leads/"))
    return { title: "Lead", parent: { label: "Leads", href: "/admin/leads" } };
  if (pathname === "/admin/leads") return { title: "Candidate Pipeline" };
  if (pathname.startsWith("/admin/members/"))
    return { title: "Member", parent: { label: "Members", href: "/admin/members" } };
  if (pathname.startsWith("/admin/members")) return { title: "Members" };
  if (pathname === "/admin/events/new")
    return { title: "New event", parent: { label: "Events", href: "/admin/events" } };
  if (pathname.startsWith("/admin/events/"))
    return { title: "Event", parent: { label: "Events", href: "/admin/events" } };
  if (pathname.startsWith("/admin/events")) return { title: "Events" };
  if (pathname.startsWith("/admin/meetings")) return { title: "Meetings" };
  if (pathname === "/admin/blog/new")
    return { title: "New post", parent: { label: "Blog", href: "/admin/blog" } };
  if (pathname.startsWith("/admin/blog/"))
    return { title: "Blog post", parent: { label: "Blog", href: "/admin/blog" } };
  if (pathname.startsWith("/admin/blog")) return { title: "Blog" };
  if (pathname.startsWith("/admin/payments")) return { title: "Payments" };
  if (pathname.startsWith("/admin/charity")) return { title: "Charity" };
  if (pathname.startsWith("/admin/donations")) return { title: "Donations" };
  if (pathname.startsWith("/admin/gift-aid")) return { title: "Gift Aid" };
  if (pathname.startsWith("/admin/settings")) return { title: "Settings" };
  return { title: "Admin" };
}

export function AdminLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";

  if (isLogin) {
    return <>{children}</>;
  }

  const { title, parent } = adminHeaderMeta(pathname);

  return (
    <div className="admin-dashboard-light flex min-h-screen bg-dash-bg text-dash-text">
      <AdminSidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header
          className={cn(
            "sticky top-0 z-20 border-b border-dash-border bg-dash-surface/95 shadow-sm backdrop-blur-md",
            "supports-[backdrop-filter]:bg-dash-surface/80"
          )}
        >
          <div className="flex h-14 items-center justify-between gap-4 px-4 pl-[3.25rem] lg:h-16 lg:pl-6 lg:pr-8">
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
                  Covenant Lodge
                </p>
              )}
              <h1 className="truncate text-lg font-semibold tracking-tight text-dash-text lg:text-xl">
                {title}
              </h1>
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <Link
                href="/"
                className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2 text-xs font-medium text-dash-muted shadow-sm transition-colors hover:border-dash-border-strong hover:bg-dash-surface hover:text-dash-text"
              >
                View site
              </Link>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col px-3 pb-3 pt-0 sm:px-4 sm:pb-4 lg:px-6 lg:pb-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-dash-border bg-dash-surface text-dash-text shadow-dash">
            <main className="flex-1 overflow-auto p-5 lg:p-8">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
}
