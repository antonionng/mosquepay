"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  Loader2,
  MapPin,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Province = {
  id: string;
  slug: string;
  name: string;
  jurisdiction: string | null;
  contact_email: string | null;
  is_active: boolean;
};

type LodgeMini = {
  id: string;
  name: string;
  slug: string;
  lodge_number: string | null;
  province_id: string | null;
};

export function ProvincesClient({
  provinces,
  lodges,
}: {
  provinces: Province[];
  lodges: LodgeMini[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    jurisdiction: "",
    contact_email: "",
  });
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const lodgesByProvince = useMemo(() => {
    const map = new Map<string, LodgeMini[]>();
    for (const lodge of lodges) {
      const key = lodge.province_id ?? "_unassigned";
      const arr = map.get(key) ?? [];
      arr.push(lodge);
      map.set(key, arr);
    }
    return map;
  }, [lodges]);

  async function createProvince(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/provinces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create province.");
      }
      setForm({ name: "", slug: "", jurisdiction: "", contact_email: "" });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function assignLodge(provinceId: string, lodgeId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/provinces/${provinceId}/lodges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lodge_id: lodgeId }),
      });
      if (!res.ok) throw new Error("Could not assign lodge.");
      setAssignFor(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Assign failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unassignLodge(provinceId: string, lodgeId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/provinces/${provinceId}/lodges?lodge_id=${lodgeId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Could not unassign lodge.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unassign failed.");
    } finally {
      setBusy(false);
    }
  }

  const unassigned = lodgesByProvince.get("_unassigned") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Provinces &amp; districts</h1>
        <p className="mt-1 text-sm text-slate-500">
          The provincial layer aggregates lodges, supports cross-lodge officer
          directories, and produces grand lodge annual returns.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <form
        onSubmit={createProvince}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Create a province
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Province name">
            <input
              required
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  name: e.target.value,
                  slug:
                    f.slug ||
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/(^-|-$)/g, ""),
                }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Slug">
            <input
              required
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Jurisdiction">
            <input
              value={form.jurisdiction}
              onChange={(e) =>
                setForm((f) => ({ ...f, jurisdiction: e.target.value }))
              }
              placeholder="e.g. UGLE Province of West Yorkshire"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Contact email">
            <input
              type="email"
              value={form.contact_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, contact_email: e.target.value }))
              }
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </Field>
        </div>
        <div className="mt-3 text-right">
          <Button type="submit" disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create province
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {provinces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            No provinces yet. Create one above to start grouping lodges.
          </div>
        ) : (
          provinces.map((province) => {
            const provinceLodges = lodgesByProvince.get(province.id) ?? [];
            return (
              <div
                key={province.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                  <div>
                    <Link
                      href={`/admin/provinces/${province.slug}`}
                      className="text-lg font-semibold text-slate-900 hover:underline"
                    >
                      {province.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {province.jurisdiction ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {province.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                    <Link href={`/admin/provinces/${province.slug}`}>
                      <Button size="sm" variant="outline">
                        <ArrowUpRight className="mr-1 h-3 w-3" /> Open
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setAssignFor(assignFor === province.id ? null : province.id)
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add lodge
                    </Button>
                  </div>
                </div>
                {assignFor === province.id && (
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    {unassigned.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        All lodges already belong to a province.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {unassigned.map((lodge) => (
                          <button
                            key={lodge.id}
                            disabled={busy}
                            onClick={() => assignLodge(province.id, lodge.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                          >
                            {lodge.name}
                            {lodge.lodge_number && (
                              <span className="ml-1 text-slate-400">
                                #{lodge.lodge_number}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lodge</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead className="w-32 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinceLodges.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-6 text-center text-sm text-slate-500"
                        >
                          <Building2 className="mx-auto mb-1 h-5 w-5 text-slate-300" />
                          No lodges yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      provinceLodges.map((lodge) => (
                        <TableRow key={lodge.id}>
                          <TableCell className="text-sm font-medium text-slate-900">
                            {lodge.name}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {lodge.lodge_number ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unassignLodge(province.id, lodge.id)}
                              disabled={busy}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
