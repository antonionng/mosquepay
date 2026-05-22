"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  CreditCard,
  Wallet,
  Heart,
  User,
  LogOut,
  Menu,
  X,
  IdCard,
  UserPlus,
} from "lucide-react";
import { useState, useEffect } from "react";

const nav = [
  { href: "/member", label: "Dashboard", icon: LayoutDashboard },
  { href: "/member/events", label: "Events", icon: Calendar },
  { href: "/member/guests", label: "Guests", icon: UserPlus },
  { href: "/member/payments", label: "Payments", icon: CreditCard },
  { href: "/member/dues", label: "Dues", icon: Wallet },
  { href: "/member/donations", label: "Donations", icon: Heart },
  { href: "/member/card", label: "My card", icon: IdCard },
  { href: "/member/profile", label: "Profile", icon: User },
];

export function MemberSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/member/session")
      .then((r) => r.json())
      .then((d) => d.user && setUser(d.user))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/member/logout", { method: "POST" });
    router.push("/member/login");
    router.refresh();
  }

  const linkBase =
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";
  const linkIdle =
    "text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text";
  const linkActive =
    "bg-[hsl(var(--dash-ring)/0.08)] text-[hsl(var(--dash-ring))]";

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
          "lg:static lg:min-h-screen lg:translate-x-0 lg:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-dash-border bg-dash-surface px-4 lg:h-[4.5rem]">
          <Link
            href="/member"
            className="flex min-w-0 items-center"
            onClick={() => setMobileOpen(false)}
            aria-label="LodgePay member portal"
          >
            <Image
              src="/brand/lodgepay-sidebar-logo.png"
              alt="LodgePay"
              width={1032}
              height={245}
              priority
              className="h-11 w-auto max-w-[11rem] object-contain lg:h-12"
            />
          </Link>
          <span className="rounded-full bg-[hsl(var(--dash-ring)/0.1)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--dash-ring))]">
            Member
          </span>
        </div>

        <nav
          aria-label="Member"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3"
        >
          <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Menu
          </p>
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/member" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
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

        {user && (
          <div className="shrink-0 border-t border-dash-border bg-dash-surface-subtle/90 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--dash-ring)/0.12)] text-xs font-semibold text-[hsl(var(--dash-ring))]">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-dash-text">
                  {user.full_name || "Member"}
                </p>
                <p className="truncate text-xs text-dash-muted">{user.email}</p>
              </div>
            </div>
          </div>
        )}
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
