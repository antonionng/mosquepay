"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  Clock,
  Heart,
  Gift,
  UserCheck,
  ShieldCheck,
  BarChart3,
  Wallet,
  HeartHandshake,
  Megaphone,
  GraduationCap,
  MapPin,
  Plug,
  Shield,
  Rocket,
  Building2,
  Globe,
  UserPlus,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/onboarding", label: "Get started", icon: Rocket, permission: "admin:all" },
  { href: "/admin/leads", label: "Candidates", icon: Users, permission: "meetings:write", flag: "candidate_crm" },
  { href: "/admin/members", label: "Members", icon: UserCheck, permission: "members:read" },
  { href: "/admin/guests", label: "Guests", icon: UserPlus, permission: "members:read", flag: "guest_links" },
  { href: "/admin/meetings", label: "Meetings", icon: Clock, permission: "meetings:write" },
  { href: "/admin/sequences", label: "Sequences", icon: Sparkles, permission: "meetings:write" },
  { href: "/admin/communications", label: "Communications", icon: Megaphone, permission: "members:write" },
  { href: "/admin/website", label: "Website", icon: Globe, permission: "website:write" },
  { href: "/admin/payments", label: "Payments", icon: CreditCard, permission: "payments:write" },
  { href: "/admin/treasurer", label: "Treasurer", icon: Wallet, permission: "payments:write" },
  { href: "/admin/charity", label: "Charity", icon: Heart, permission: "charity:write", flag: "charity_campaigns" },
  { href: "/admin/donations", label: "Donations", icon: Gift, permission: "charity:write", flag: "gift_aid" },
  { href: "/admin/gift-aid", label: "Gift Aid", icon: Shield, permission: "charity:write", flag: "gift_aid" },
  { href: "/admin/almoner", label: "Almoner", icon: HeartHandshake, permission: "welfare:read", flag: "almoner" },
  { href: "/admin/mentoring", label: "Mentoring", icon: GraduationCap, permission: "members:write", flag: "mentor" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, permission: "audit:read" },
  { href: "/admin/audit-compliance", label: "Audit & Compliance", icon: ShieldCheck, permission: "audit:read", flag: "audit" },
  { href: "/admin/platform", label: "Platform overview", icon: Building2, permission: "admin:all", platformOnly: true },
  { href: "/admin/provinces", label: "Provinces", icon: MapPin, permission: "admin:all", platformOnly: true },
  { href: "/admin/integrations", label: "Integrations", icon: Plug, permission: "admin:all", flag: "integrations" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "admin:all" },
];

const rolePermissions: Record<string, string[]> = {
  super_admin: ["admin:all"],
  operator: ["admin:all"],
  secretary: [
    "members:read",
    "members:write",
    "meetings:write",
    "summons:write",
    "website:write",
    "audit:read",
    "welfare:read",
  ],
  treasurer: ["payments:write", "audit:read"],
  charity_steward: ["charity:write", "audit:read"],
  membership_officer: ["members:read", "members:write", "audit:read"],
  almoner: ["members:read", "welfare:read", "welfare:write", "audit:read"],
  master: [
    "members:read",
    "meetings:write",
    "summons:write",
    "website:write",
    "audit:read",
  ],
};

function canSee(role: string, permission?: string) {
  if (!permission) return true;
  const permissions = rolePermissions[role] ?? rolePermissions.secretary;
  return permissions.includes("admin:all") || permissions.includes(permission);
}

function flagAllows(flags: Record<string, boolean>, flag?: string) {
  if (!flag) return true;
  return flags[flag] !== false;
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [role, setRole] = useState("super_admin");
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [scopeKind, setScopeKind] = useState<string>("none");

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.admin?.role) setRole(data.admin.role);
        if (data.flags && typeof data.flags === "object") setFlags(data.flags);
        if (data.scope?.kind) setScopeKind(data.scope.kind);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const canSeePlatformOnly = scopeKind === "platform" || scopeKind === "dummy";
  const visibleNav = nav.filter(
    (item) =>
      canSee(role, item.permission) &&
      flagAllows(flags, item.flag) &&
      (!item.platformOnly || canSeePlatformOnly)
  );
  const mainNav = visibleNav.filter((item) =>
    [
      "/admin",
      "/admin/onboarding",
      "/admin/leads",
      "/admin/members",
      "/admin/guests",
      "/admin/meetings",
      "/admin/sequences",
      "/admin/communications",
      "/admin/website",
      "/admin/mentoring",
      "/admin/almoner",
    ].includes(item.href)
  );
  const financeNav = visibleNav.filter((item) =>
    [
      "/admin/payments",
      "/admin/treasurer",
      "/admin/charity",
      "/admin/donations",
      "/admin/gift-aid",
    ].includes(item.href)
  );
  const manageNav = visibleNav.filter((item) =>
    [
      "/admin/reports",
      "/admin/audit-compliance",
      "/admin/integrations",
      "/admin/settings",
    ].includes(item.href)
  );
  const platformNav = visibleNav.filter((item) =>
    [
      "/admin/platform",
      "/admin/provinces",
    ].includes(item.href)
  );

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const linkBase =
    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-dash-surface";
  const linkIdle =
    "text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text";
  const linkActive =
    "bg-[hsl(var(--dash-ring)/0.08)] text-[hsl(var(--dash-ring))]";

  function navLink(item: { href: string; label: string; icon: typeof LayoutDashboard }) {
    const Icon = item.icon;
    const active =
      pathname === item.href ||
      (item.href !== "/admin" && pathname.startsWith(item.href));
    return (
      <Link
        key={item.href + item.label}
        href={item.href}
        prefetch={false}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(linkBase, active ? linkActive : linkIdle)}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
        {item.label}
      </Link>
    );
  }

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
        <div className="flex h-16 shrink-0 items-center border-b border-dash-border bg-dash-surface px-4 lg:h-[4.5rem]">
          <Link
            href="/admin"
            className="flex min-w-0 items-center"
            onClick={() => setMobileOpen(false)}
            aria-label="LodgePay admin"
          >
            <Image
              src="/brand/lodgepay-sidebar-logo.png"
              alt="LodgePay"
              width={1032}
              height={245}
              priority
              className="h-11 w-auto max-w-[13.75rem] object-contain lg:h-12"
            />
          </Link>
        </div>

        <nav
          aria-label="Admin"
          className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-3"
        >
          <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Main
          </p>
          {mainNav.map((item) => navLink(item))}

          <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Finance
          </p>
          {financeNav.map((item) => navLink(item))}

          <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
            Manage
          </p>
          {manageNav.map((item) => navLink(item))}

          {platformNav.length > 0 && (
            <>
              <p className="px-3 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
                Platform
              </p>
              {platformNav.map((item) => navLink(item))}
            </>
          )}

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
