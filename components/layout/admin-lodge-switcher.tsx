"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LodgeOption = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  is_active: boolean;
};

type LodgeContextResponse = {
  selectedSlug: string;
  selectedLodge: LodgeOption | null;
  lodges: LodgeOption[];
};

export function AdminLodgeSwitcher() {
  const router = useRouter();
  const [data, setData] = useState<LodgeContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/admin/lodge-context");
        if (!res.ok) return;
        const nextData = (await res.json()) as LodgeContextResponse;
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
  const selectedName = data?.selectedLodge?.name ?? "Selected lodge";
  const siteHref = useMemo(
    () => (selectedSlug ? `/?lodge=${encodeURIComponent(selectedSlug)}` : "/"),
    [selectedSlug]
  );

  async function handleChange(nextSlug: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/lodge-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lodge_slug: nextSlug }),
      });
      if (!res.ok) return;
      const nextData = await res.json();
      setData((current) =>
        current
          ? {
              ...current,
              selectedSlug: nextData.selectedSlug,
              selectedLodge: nextData.selectedLodge,
            }
          : current
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="h-9 w-48 animate-pulse rounded-lg bg-dash-surface-subtle" />
    );
  }

  if (!data || data.lodges.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="admin-lodge-switcher">
        Current lodge
      </label>
      <select
        id="admin-lodge-switcher"
        value={selectedSlug}
        disabled={saving}
        onChange={(event) => handleChange(event.target.value)}
        className="h-9 max-w-[13rem] rounded-lg border border-dash-border bg-dash-surface-subtle px-3 text-xs font-medium text-dash-text shadow-sm outline-none transition-colors hover:border-dash-border-strong focus:border-dash-ring"
        title={selectedName}
      >
        {data.lodges.map((lodge) => (
          <option key={lodge.id} value={lodge.slug}>
            {lodge.name}
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
