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

type Network = {
  id: string;
  slug: string;
  name: string;
  jurisdiction: string | null;
  contact_email: string | null;
  is_active: boolean;
};

type ChurchMini = {
  id: string;
  name: string;
  slug: string;
  church_number: string | null;
  network_id: string | null;
};

export function NetworksClient({
  networks,
  churches,
}: {
  networks: Network[];
  churches: ChurchMini[];
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

  const churchesByNetwork = useMemo(() => {
    const map = new Map<string, ChurchMini[]>();
    for (const church of churches) {
      const key = church.network_id ?? "_unassigned";
      const arr = map.get(key) ?? [];
      arr.push(church);
      map.set(key, arr);
    }
    return map;
  }, [churches]);

  async function createNetwork(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not create network.");
      }
      setForm({ name: "", slug: "", jurisdiction: "", contact_email: "" });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  async function assignChurch(networkId: string, churchId: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/networks/${networkId}/churches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ church_id: churchId }),
      });
      if (!res.ok) throw new Error("Could not assign church.");
      setAssignFor(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Assign failed.");
    } finally {
      setBusy(false);
    }
  }

  async function unassignChurch(networkId: string, churchId: string) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/networks/${networkId}/churches?church_id=${churchId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Could not unassign church.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unassign failed.");
    } finally {
      setBusy(false);
    }
  }

  const unassigned = churchesByNetwork.get("_unassigned") ?? [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Networks &amp; districts</h1>
        <p className="mt-1 text-sm text-slate-500">
          The network layer aggregates churches, supports cross-church officer
          directories, and produces grand church annual returns.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <form
        onSubmit={createNetwork}
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Create a network
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Network name">
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
              placeholder="e.g. UGLE Network of West Yorkshire"
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
            Create network
          </Button>
        </div>
      </form>

      <div className="space-y-4">
        {networks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            <MapPin className="mx-auto mb-2 h-6 w-6 text-slate-300" />
            No networks yet. Create one above to start grouping churches.
          </div>
        ) : (
          networks.map((network) => {
            const networkChurches = churchesByNetwork.get(network.id) ?? [];
            return (
              <div
                key={network.id}
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                  <div>
                    <Link
                      href={`/admin/networks/${network.slug}`}
                      className="text-lg font-semibold text-slate-900 hover:underline"
                    >
                      {network.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {network.jurisdiction ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {network.is_active ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                    <Link href={`/admin/networks/${network.slug}`}>
                      <Button size="sm" variant="outline">
                        <ArrowUpRight className="mr-1 h-3 w-3" /> Open
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setAssignFor(assignFor === network.id ? null : network.id)
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add church
                    </Button>
                  </div>
                </div>
                {assignFor === network.id && (
                  <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    {unassigned.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        All churches already belong to a network.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {unassigned.map((church) => (
                          <button
                            key={church.id}
                            disabled={busy}
                            onClick={() => assignChurch(network.id, church.id)}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50"
                          >
                            {church.name}
                            {church.church_number && (
                              <span className="ml-1 text-slate-400">
                                #{church.church_number}
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
                      <TableHead>Church</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead className="w-32 text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networkChurches.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="py-6 text-center text-sm text-slate-500"
                        >
                          <Building2 className="mx-auto mb-1 h-5 w-5 text-slate-300" />
                          No churches yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      networkChurches.map((church) => (
                        <TableRow key={church.id}>
                          <TableCell className="text-sm font-medium text-slate-900">
                            {church.name}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {church.church_number ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unassignChurch(network.id, church.id)}
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
