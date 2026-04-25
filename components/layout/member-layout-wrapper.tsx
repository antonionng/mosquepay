"use client";

import { usePathname } from "next/navigation";
import { MemberSidebar } from "@/components/layout/member-sidebar";

export function MemberLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuth = pathname === "/member/login" || pathname === "/member/signup";

  if (isAuth) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <MemberSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
