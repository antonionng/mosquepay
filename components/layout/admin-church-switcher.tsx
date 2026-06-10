"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type ChurchOption = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  is_active: boolean;
};

type ChurchContextResponse = {
  selectedSlug: string;
  selectedChurch: ChurchOption | null;
  churches: ChurchOption[];
};

type Variant = "header" | "sidebar";

type Props = {
  variant?: Variant;
  // Fires after a successful church change so the parent (e.g. the mobile
  // sidebar) can close itself before the route refreshes.
  onAfterChange?: () => void;
};

// The church switcher is rendered in two places:
//   1. The admin top header (variant="header") at sm+ — a tight inline pill.
//   2. The admin sidebar (variant="sidebar") at all sizes — a stacked block
//      so phone users can switch church from the hamburger drawer.
// Single source of truth keeps both in lock-step.
export function AdminChurchSwitcher({ variant = "header", onAfterChange }: Props = {}) {
  const router = useRouter();
  const [data, setData] = useState<ChurchContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/church-context");
        if (!res.ok) return;
        const nextData = (await res.json()) as ChurchContextResponse;
        if (mounted) setData(nextData);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSlug = data?.selectedSlug ?? "";
  const selectedName = data?.selectedChurch?.name ?? "Selected church";
  const siteHref = useMemo(
    () => (selectedSlug ? `/?church=${encodeURIComponent(selectedSlug)}` : "/"),
    [selectedSlug]
  );

  async function handleChange(nextSlug: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/church-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ church_slug: nextSlug }),
      });
      if (!res.ok) return;
      const nextData = await res.json();
      setData((current) =>
        current
          ? {
              ...current,
              selectedSlug: nextData.selectedSlug,
              selectedChurch: nextData.selectedChurch,
            }
          : current
      );
      onAfterChange?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return variant === "sidebar" ? (
      <div className="space-y-2">
        <div className="h-3 w-20 animate-pulse rounded bg-dash-surface-subtle" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-dash-surface-subtle" />
      </div>
    ) : (
      <div className="h-9 w-48 animate-pulse rounded-lg bg-dash-surface-subtle" />
    );
  }

  if (!data || data.churches.length === 0) {
    return null;
  }

  // Single-church admins don't need a picker; show a context chip so they
  // always know which church they're operating on (especially valuable in
  // the sidebar for network admins who multi-tenant frequently).
  const isSingleChurch = data.churches.length === 1;

  if (variant === "sidebar") {
    return (
      <div className="space-y-2">
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-dash-faint">
          Working in
        </p>
        {isSingleChurch ? (
          <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2.5">
            <Building2 className="h-4 w-4 shrink-0 text-dash-muted" aria-hidden />
            <span className="truncate text-sm font-medium text-dash-text" title={selectedName}>
              {selectedName}
            </span>
          </div>
        ) : (
          <div className="relative">
            <Building2
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted"
              aria-hidden
            />
            <label className="sr-only" htmlFor="admin-church-switcher-sidebar">
              Current church
            </label>
            <select
              id="admin-church-switcher-sidebar"
              value={selectedSlug}
              disabled={saving}
              onChange={(event) => handleChange(event.target.value)}
              className={cn(
                "h-10 w-full appearance-none rounded-lg border border-dash-border bg-dash-surface pl-9 pr-8 text-sm font-medium text-dash-text shadow-sm outline-none transition-colors",
                "hover:border-dash-border-strong focus:border-dash-ring focus:ring-2 focus:ring-dash-ring/20",
                saving && "opacity-60"
              )}
              title={selectedName}
            >
              {data.churches.map((church) => (
                <option key={church.id} value={church.slug}>
                  {church.name}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
            >
              <path
                d="M6 8l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
        <Link
          href={siteHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 text-sm font-medium text-dash-muted shadow-sm transition-colors hover:border-dash-border-strong hover:bg-dash-surface-subtle hover:text-dash-text"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          View live site
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="admin-church-switcher">
        Current church
      </label>
      <select
        id="admin-church-switcher"
        value={selectedSlug}
        disabled={saving}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 max-w-[13rem] rounded-lg border border-dash-border bg-dash-surface-subtle px-3 text-xs font-medium text-dash-text shadow-sm outline-none transition-colors hover:border-dash-border-strong focus:border-dash-ring"
        title={selectedName}
      >
        {data.churches.map((church) => (
          <option key={church.id} value={church.slug}>
            {church.name}
          </option>
        ))}
      </select>
      <Link
        href={siteHref}
        className="rounded-lg border border-dash-border bg-dash-surface-subtle px-3 py-2 text-xs font-medium text-dash-muted shadow-sm transition-colors hover:border-dash-border-strong hover:bg-dash-surface hover:text-dash-text"
      >
        View site
      </Link>
    </div>
  );
}
