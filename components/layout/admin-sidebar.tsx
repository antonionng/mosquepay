"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  Heart,
  Gift,
  Globe,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/members", label: "Members", icon: UserCheck },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/meetings", label: "Meetings", icon: Clock },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/charity", label: "Charity", icon: Heart },
  { href: "/admin/donations", label: "Donations", icon: Gift },
  { href: "/admin/settings", label: "Site Builder", icon: Globe },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const linkBase =
    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";
  const linkIdle =
    "text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text";
  const linkActive =
    "bg-dash-surface-subtle text-dash-text shadow-sm ring-1 ring-dash-border";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed left-3 top-3 z-50 h-10 w-10 border border-dash-border bg-dash-surface text-dash-text shadow-sm lg:hidden",
          "hover:bg-dash-surface-subtle hover:text-dash-text"
        )}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17rem] flex-col border-r border-dash-border bg-dash-surface shadow-sm transition-transform",
          "lg:static lg:min-h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-dash-border px-4 lg:h-[4.5rem]">
          <Link href="/admin" className="flex min-w-0 items-center gap-3" onClick={() => setMobileOpen(false)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-dash-border bg-dash-surface-subtle text-[11px] font-semibold tracking-[0.18em] text-dash-text shadow-sm">
              CL
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-dash-text">Covenant Lodge</p>
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-dash-border bg-dash-surface-subtle px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-dash-ring">
                  <Sparkles className="h-2.5 w-2.5" aria-hidden />
                  Pro
                </span>
              </div>
              <p className="text-xs text-dash-faint">No. 4344</p>
            </div>
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Main
          </p>
          {nav.slice(0, 6).map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(linkBase, active ? linkActive : linkIdle)}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Finance
          </p>
          {nav.slice(6, 9).map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(linkBase, active ? linkActive : linkIdle)}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Manage
          </p>
          {nav.slice(9).map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(linkBase, active ? linkActive : linkIdle)}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              linkBase,
              "mt-3 text-dash-faint hover:bg-red-50 hover:text-red-700"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden />
            Log out
          </button>
        </nav>

        <div className="shrink-0 border-t border-dash-border bg-dash-surface-subtle/90 p-3 backdrop-blur-sm">
          <Link
            href="/"
            className="block rounded-lg px-3 py-2 text-xs font-medium text-dash-muted transition-colors hover:bg-dash-surface hover:text-dash-ring"
            onClick={() => setMobileOpen(false)}
          >
            View site
          </Link>
        </div>
      </aside>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-dash-text/20 backdrop-blur-[2px] lg:hidden"
          aria-hidden
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
