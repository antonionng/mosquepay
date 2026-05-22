"use client";

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

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden text-slate-700 hover:bg-slate-100"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white transform transition-transform lg:translate-x-0 lg:static lg:shrink-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Link href="/member" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
              LP
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">Member Portal</p>
              <p className="text-xs text-slate-500 truncate">LodgePay</p>
            </div>
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 p-3 overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>
          <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
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
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-blue-600" : "text-slate-400")} />
                {item.label}
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </nav>

        {user && (
          <div className="absolute bottom-0 left-0 right-0 border-t border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                {(user.full_name || user.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user.full_name || "Member"}
                </p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
