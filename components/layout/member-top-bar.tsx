"use client";

import { useRouter, usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// Native-feel top app bar for the member portal on phone.
// - Shows page title centred above the content.
// - When we're on a child route (not one of the top-level tab destinations)
//   we show a back-chevron on the left so users can return to the parent
//   without hunting for the browser back button. This is the same iOS
//   pattern used by Mail, Settings, etc.
// - Honours env(safe-area-inset-top) so the title never collides with the
//   notch / status bar.

const META: Record<string, { title: string; isRoot?: boolean }> = {
  "/member": { title: "Dashboard", isRoot: true },
  "/member/events": { title: "Events", isRoot: true },
  "/member/dues": { title: "Pay", isRoot: true },
  "/member/payments": { title: "Payments" },
  "/member/donations": { title: "Donations" },
  "/member/card": { title: "Member card", isRoot: true },
  "/member/profile": { title: "Profile", isRoot: true },
  "/member/guests": { title: "Guests" },
};

function resolveMeta(pathname: string): { title: string; isRoot: boolean } {
  const exact = META[pathname];
  if (exact) return { title: exact.title, isRoot: Boolean(exact.isRoot) };
  // Heuristics for dynamic routes.
  if (pathname.startsWith("/member/events/")) return { title: "Event", isRoot: false };
  if (pathname.startsWith("/member/dues/")) return { title: "Dues", isRoot: false };
  if (pathname.startsWith("/member/payments/")) return { title: "Payment", isRoot: false };
  if (pathname.startsWith("/member/donations/")) return { title: "Donation", isRoot: false };
  return { title: "Member", isRoot: true };
}

export function MemberTopBar() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { title, isRoot } = resolveMeta(pathname);

  return (
    <header
      className={cn(
        // Sticky so the title stays visible as content scrolls underneath.
        // pl-14 reserves space for the floating hamburger that lives in
        // the same leading slot (MemberSidebar renders it at left-3 with
        // a 40px-wide control; 14 = 56px so there's a small gap).
        "sticky top-0 z-20 border-b border-dash-border bg-dash-surface/95 backdrop-blur-md lg:hidden",
        "pt-[env(safe-area-inset-top)]"
      )}
    >
      <div className="flex h-14 items-center gap-1 pl-14 pr-4">
        {!isRoot && (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-dash-text transition-colors hover:bg-dash-surface-subtle"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <h1 className="flex-1 truncate text-base font-semibold tracking-tight text-dash-text">
          {title}
        </h1>
      </div>
    </header>
  );
}
