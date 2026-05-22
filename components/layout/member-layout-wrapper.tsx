"use client";

import { usePathname } from "next/navigation";
import { MemberSidebar } from "@/components/layout/member-sidebar";
import { PwaBootstrapper } from "@/components/member/pwa-bootstrapper";

export function MemberLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth =
    pathname === "/member/login" ||
    pathname === "/member/signup" ||
    pathname === "/member/accept-invite";

  if (isAuth) {
    return (
      <>
        {children}
        <PwaBootstrapper />
      </>
    );
  }

  return (
    <div className="admin-dashboard-light flex min-h-screen bg-dash-bg">
      <MemberSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
      <PwaBootstrapper />
    </div>
  );
}
