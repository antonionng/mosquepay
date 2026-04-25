"use client";

import { useState, useMemo } from "react";
import {
  CheckCircle2,
  XCircle,
  Users,
  Search,
  UserCheck,
} from "lucide-react";

type Rsvp = {
  id: string;
  user_name: string;
  user_email: string;
  status: string;
};

export function AttendanceCheckin({
  eventId,
  rsvps,
}: {
  eventId: string;
  rsvps: Rsvp[];
}) {
  void eventId;
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    rsvps.forEach((r) => {
      map[r.id] = false;
    });
    return map;
  });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return rsvps;
    const q = search.toLowerCase();
    return rsvps.filter(
      (r) =>
        r.user_name.toLowerCase().includes(q) ||
        r.user_email.toLowerCase().includes(q)
    );
  }, [rsvps, search]);

  const checkedIn = Object.values(attendance).filter(Boolean).length;
  const total = rsvps.length;

  function toggleAttendance(id: string) {
    setAttendance((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function markAllPresent() {
    setAttendance((prev) => {
      const next = { ...prev };
      rsvps.forEach((r) => {
        next[r.id] = true;
      });
      return next;
    });
  }

  if (rsvps.length === 0) {
    return (
      <div className="admin-surface p-8 text-center">
        <Users className="mx-auto h-8 w-8 text-dash-muted" />
        <p className="mt-3 text-sm text-dash-muted">No RSVPs for this event.</p>
      </div>
    );
  }

  return (
    <div className="admin-surface p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-dash-text">Attendance Check-in</h2>
        <button
          onClick={markAllPresent}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500"
        >
          <UserCheck className="h-3.5 w-3.5" />
          Mark All Present
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-center">
          <p className="text-2xl font-semibold text-dash-text">{total}</p>
          <p className="mt-1 text-[11px] text-dash-muted">Total RSVPs</p>
        </div>
        <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-center">
          <p className="text-2xl font-semibold text-emerald-600">{checkedIn}</p>
          <p className="mt-1 text-[11px] text-dash-muted">Checked In</p>
        </div>
        <div className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4 text-center">
          <p className="text-2xl font-semibold text-amber-600">{total - checkedIn}</p>
          <p className="mt-1 text-[11px] text-dash-muted">Not Yet</p>
        </div>
      </div>

      {total > 0 && (
        <div className="mb-4 h-2 rounded-full bg-dash-border overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
            style={{ width: `${Math.round((checkedIn / total) * 100)}%` }}
          />
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dash-muted" />
        <input
          type="text"
          placeholder="Search attendees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-dash-border bg-dash-surface py-2.5 pl-10 pr-4 text-sm text-dash-text placeholder:text-dash-faint focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
        />
      </div>

      <div className="space-y-2">
        {filtered.map((r) => {
          const present = attendance[r.id] ?? false;
          return (
            <div
              key={r.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                present
                  ? "border-emerald-200 bg-emerald-50/80"
                  : "border-dash-border bg-dash-surface-subtle"
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-dash-text truncate">{r.user_name}</p>
                <p className="text-xs text-dash-muted truncate">{r.user_email}</p>
              </div>
              <button
                onClick={() => toggleAttendance(r.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  present
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : "border border-dash-border bg-dash-surface text-dash-muted hover:bg-dash-surface-subtle hover:text-dash-text"
                }`}
              >
                {present ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Attended
                  </>
                ) : (
                  <>
                    <XCircle className="h-3.5 w-3.5" />
                    Mark Attended
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
