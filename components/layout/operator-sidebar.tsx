"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HeadphonesIcon,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/operator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/operator/lodges", label: "Lodges", icon: Building2 },
  { href: "/operator/billing", label: "Billing", icon: CreditCard },
  { href: "/operator/support", label: "Support", icon: HeadphonesIcon },
];

export function OperatorSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </Button>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-slate-950/95 backdrop-blur-xl transform transition-transform lg:translate-x-0 lg:static",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-5">
          <Link href="/operator" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold tracking-[0.18em] text-white">
              OP
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                Operator Console
              </p>
              <p className="text-xs text-slate-500">Platform Management</p>
            </div>
          </Link>
        </div>

        <nav
          className="flex flex-col gap-0.5 p-3 overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 8rem)" }}
        >
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Platform
          </p>
          {nav.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/operator" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <Link
            href="/admin"
            className="block rounded-xl px-3 py-2 text-xs text-slate-500 transition-colors hover:bg-white/5 hover:text-blue-300"
          >
            Switch to Admin
          </Link>
        </div>
      </aside>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
