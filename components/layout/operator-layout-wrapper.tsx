"use client";

import { usePathname } from "next/navigation";
import { OperatorSidebar } from "@/components/layout/operator-sidebar";

export function OperatorLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLogin = pathname === "/operator/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="admin-shell flex">
      <OperatorSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
