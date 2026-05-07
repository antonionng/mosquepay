"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/telemetry";

export function PageViewTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = search?.toString();
    trackPageView(pathname, query ? { query } : {});
  }, [pathname, search]);

  return null;
}
