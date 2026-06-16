"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { GuestFormDialog } from "@/components/admin/guest-form-dialog";

export type GuestRow = {
  id: string;
  full_name: string;
  email: string | null;
  mother_mosque_name: string | null;
  mother_mosque_number: string | null;
  is_member: boolean;
  guest_category?: "guest" | "honorary_guest";
  dining_waived?: boolean;
  guest_dining_amount?: number | null;
  visit_count: number;
  archived_at: string | null;
  created_at: string;
  source:
    | "admin"
    | "member_invite"
    | "self_invite_event"
    | "self_register";
};

type Props = {
  guests: GuestRow[];
  search: string;
  showArchived: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Never";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function GuestsDirectoryClient({
  guests,
  search,
  showArchived,
}: Props) {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState(search);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function applyFilters(next: { q?: string; archived?: boolean }) {
    const params = new URLSearchParams();
    const q = next.q ?? searchValue;
    if (q) params.set("q", q);
    const archived = next.archived ?? showArchived;
    if (archived) params.set("archived", "true");
    startTransition(() => {
      router.push(`/admin/guests${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-dash-border bg-dash-surface-subtle px-5 py-3">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters({ q: searchValue });
            }}
            className="flex flex-1 items-center gap-2"
          >
            <div className="relative flex-1 min-w-[14rem]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by name, email, or mother mosque..."
                className="w-full rounded-md border border-dash-border bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-dash-ring/30"
              />
            </div>
            <Button type="submit" size="sm" variant="primary">
              Search
            </Button>
          </form>

          <label className="flex items-center gap-2 text-xs text-dash-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) =>
                applyFilters({ archived: event.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-600"
            />
            Show archived
          </label>

          <Button
            type="button"
            size="sm"
            variant="dashboard"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add guest
          </Button>
        </div>

        {guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-sm font-medium text-dash-text">
              {pending ? "Loading..." : "No guests yet."}
            </p>
            <p className="mt-1 text-sm text-dash-muted">
              Guests added through invitations or by an admin will appear
              here.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-dash-surface-subtle text-xs uppercase tracking-wider text-dash-muted">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">
                  Mother mosque
                </th>
                <th className="px-5 py-3 text-left font-medium">Visits</th>
                <th className="px-5 py-3 text-left font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {guests.map((guest) => (
                <tr
                  key={guest.id}
                  className={
                    guest.archived_at
                      ? "bg-slate-50 text-slate-400 hover:bg-slate-100"
                      : "hover:bg-dash-surface-subtle/40"
                  }
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/guests/${guest.id}`}
                      className="font-medium hover:text-dash-ring"
                    >
                      {guest.full_name}
                    </Link>
                    {guest.guest_category === "honorary_guest" ? (
                      <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                        Honorary
                      </span>
                    ) : null}
                    {guest.dining_waived ? (
                      <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        Comp dining
                      </span>
                    ) : null}
                    {guest.is_member ? (
                      <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700">
                        member
                      </span>
                    ) : null}
                    {guest.source === "self_register" ? (
                      <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                        Self-registered
                      </span>
                    ) : null}
                    {guest.archived_at ? (
                      <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        Archived
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    {guest.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {guest.email}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {guest.mother_mosque_name ? (
                      <>
                        {guest.mother_mosque_name}
                        {guest.mother_mosque_number
                          ? ` No. ${guest.mother_mosque_number}`
                          : ""}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-5 py-3">{guest.visit_count}</td>
                  <td className="px-5 py-3">
                    {formatDate(guest.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <GuestFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </>
  );
}
