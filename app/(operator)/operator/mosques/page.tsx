"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Plus,
  MapPin,
  ArrowUpRight,
} from "lucide-react";
import type { Mosque } from "@/lib/db/types";
import { formatDate } from "@/lib/utils";

export default function MosquesListPage() {
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/mosques")
      .then((r) => r.json())
      .then((data) => setMosques(Array.isArray(data) ? data : []))
      .catch(() => {
        setError("Could not load mosques. Try refreshing the page.");
        setMosques([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = mosques.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.slug.toLowerCase().includes(search.toLowerCase()) ||
      (l.city ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Mosques</h1>
          <p className="admin-page-copy">
            Manage all mosques on the platform
          </p>
        </div>
        <Link
          href="/operator/mosques/new"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Onboard New Mosque
        </Link>
      </div>

      <div className="admin-surface p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, slug, or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="admin-surface p-10 text-center text-slate-500">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
          <p className="mt-3 text-sm">Loading mosques…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="admin-surface p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-600" />
          <p className="mt-3 text-sm text-slate-500">
            {search
              ? "No mosques match your search"
              : "No mosques onboarded yet"}
          </p>
          {!search && (
            <Link
              href="/operator/mosques/new"
              className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              Onboard your first mosque
            </Link>
          )}
        </div>
      ) : (
        <div className="admin-table-shell">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mosque</th>
                <th className="hidden md:table-cell">Slug</th>
                <th className="hidden sm:table-cell">City</th>
                <th>Status</th>
                <th className="hidden lg:table-cell">Created</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((mosque) => (
                <tr key={mosque.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-semibold text-white">
                        {mosque.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">{mosque.name}</p>
                        <p className="text-xs text-slate-500 md:hidden">
                          {mosque.slug}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell text-slate-400">
                    {mosque.slug}
                  </td>
                  <td className="hidden sm:table-cell">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      {mosque.city ?? "Not recorded"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        mosque.is_active
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {mosque.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell text-slate-500 text-sm">
                    {formatDate(mosque.created_at)}
                  </td>
                  <td>
                    <Link
                      href={`/operator/mosques/${mosque.slug}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
