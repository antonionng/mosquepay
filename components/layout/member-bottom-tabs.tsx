"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Wallet,
  IdCard,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Native bottom tab bar for the member portal. Phone-only (hidden at lg).
// 5 destinations is the sweet spot — iOS HIG says 3–5 tabs, anything more
// turns into a horizontal scroll which feels weak. We collapse Payments and
// Dues into a single "Pay" tab to stay at 5.
//
// - Honours env(safe-area-inset-bottom) so the bar sits above the iOS
//   home-indicator without ever being clipped.
// - Each tab is 56px tall (Material spec) with a 44pt+ tap target.
// - Active state is filled icon + brand colour; idle is outlined muted.
// - We use prefetch={false} so adding 5 nav links to every page doesn't
//   fan out 5 RSC prefetches per visit.

const tabs = [
  { href: "/member", label: "Home", icon: LayoutDashboard, match: (p: string) => p === "/member" },
  { href: "/member/events", label: "Events", icon: Calendar, match: (p: string) => p.startsWith("/member/events") },
  // Combined pay tab: lands on /member/dues which has the outstanding
  // balance summary at the top and links to payments history below.
  { href: "/member/dues", label: "Pay", icon: Wallet, match: (p: string) => p.startsWith("/member/dues") || p.startsWith("/member/payments") || p.startsWith("/member/donations") },
  { href: "/member/card", label: "Card", icon: IdCard, match: (p: string) => p.startsWith("/member/card") },
  { href: "/member/profile", label: "Profile", icon: User, match: (p: string) => p.startsWith("/member/profile") },
] as const;

export function MemberBottomTabs() {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Member sections"
      className={cn(
        // Sticky to viewport bottom, edge-to-edge, blurred surface for the
        // iOS app feel. Sub-pixel border-top stops it floating against the
        // page content.
        "fixed inset-x-0 bottom-0 z-30 border-t border-dash-border bg-dash-surface/95 backdrop-blur-md lg:hidden",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <ul className="mx-auto grid max-w-3xl grid-cols-5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = tab.match(pathname);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                  active
                    ? "text-[hsl(var(--dash-ring))]"
                    : "text-dash-muted hover:text-dash-text active:bg-dash-surface-subtle"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-all",
                    active && "scale-110"
                  )}
                  // Solid fill on active by using stroke color + a small inner
                  // dot for that "native filled icon" feel without shipping a
                  // second icon set.
                  strokeWidth={active ? 2.4 : 1.75}
                  aria-hidden
                />
                <span className={cn("leading-none", active && "font-semibold")}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
