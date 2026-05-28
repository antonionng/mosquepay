"use client";

import { usePathname } from "next/navigation";
import { MemberSidebar } from "@/components/layout/member-sidebar";
import { MemberBottomTabs } from "@/components/layout/member-bottom-tabs";
import { MemberTopBar } from "@/components/layout/member-top-bar";
import { PwaBootstrapper } from "@/components/member/pwa-bootstrapper";

export function MemberLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth =
    pathname === "/member/login" ||
    pathname === "/member/signup" ||
    pathname === "/member/accept-invite" ||
    pathname === "/member/forgot-password" ||
    pathname === "/member/reset-password";

  if (isAuth) {
    return (
      <>
        {children}
        <PwaBootstrapper />
      </>
    );
  }

  // Layout on phone: sticky top app bar + scrollable content + bottom tab
  // bar. Both are hidden on lg+ where the persistent sidebar takes over.
  // The bottom padding on <main> reserves space for the tab bar (56px) +
  // safe-area-inset-bottom so phone content never sits under the bar.
  return (
    <div className="admin-dashboard-light flex min-h-screen bg-dash-bg">
      <MemberSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MemberTopBar />
        <main
          className="flex-1 px-4 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-4 sm:p-6 lg:p-8 lg:pb-8"
        >
          {children}
        </main>
      </div>
      <MemberBottomTabs />
      <PwaBootstrapper />
    </div>
  );
}
