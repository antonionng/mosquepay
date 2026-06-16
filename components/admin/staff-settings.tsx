"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Save,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type StaffRole =
  | "secretary"
  | "treasurer"
  | "charity_steward"
  | "membership_officer"
  | "pastoral_care"
  | "master"
  | "operator";

type StaffUser = {
  id: string;
  mosque_id: string | null;
  email: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  permissions: string[];
};

const ROLE_OPTIONS: Array<{
  value: StaffRole;
  label: string;
  description: string;
}> = [
  {
    value: "secretary",
    label: "Secretary",
    description:
      "Full access to this mosque: members, services, payments, charity, pastoral, website, and settings.",
  },
  {
    value: "treasurer",
    label: "Treasurer",
    description: "Payments, giving, exports, reconciliation, and audit trail.",
  },
  {
    value: "charity_steward",
    label: "Charity Steward",
    description: "Campaigns, donations, Gift Aid, and audit trail.",
  },
  {
    value: "membership_officer",
    label: "Membership Officer",
    description: "Member records and membership workflow.",
  },
  {
    value: "pastoral_care",
    label: "PastoralCare",
    description: "PastoralCare cases, visits, alerts, and pastoral register.",
  },
  {
    value: "master",
    label: "Master",
    description: "Service oversight, notice visibility, and audit trail.",
  },
  {
    value: "operator",
    label: "Operator",
    description: "Platform-wide access across mosques.",
  },
];

const ROLE_LABELS = Object.fromEntries(
  ROLE_OPTIONS.map((role) => [role.value, role.label])
) as Record<StaffRole, string>;

function emptyForm() {
  return {
    full_name: "",
    email: "",
    role: "secretary" as StaffRole,
    active: true,
    send_invite: false,
  };
}

export function StaffSettings() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Record<string, StaffUser>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const activeCount = useMemo(
    () => staff.filter((member) => member.active).length,
    [staff]
  );

  async function loadStaff() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/staff");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not load staff.");
      }
      setStaff(data.staff ?? []);
      setEditing(
        Object.fromEntries(
          (data.staff ?? []).map((member: StaffUser) => [member.id, member])
        )
      );
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not load staff.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStaff();
  }, []);

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          active: form.active,
          send_invite: form.send_invite,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not create staff user.");
      }
      const requestedInvite = form.send_invite;
      setForm(emptyForm());
      let text = "Staff user created. Use the Invite button to email an access link.";
      if (requestedInvite) {
        text = data.invite?.sent
          ? "Staff user created and invite email sent."
          : `Staff user created, but the invite was not sent: ${data.invite?.error ?? "unknown error"}`;
      }
      setMessage({ type: "success", text });
      await loadStaff();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not create staff user.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendInvite(id: string) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "send_invite" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send staff invite.");
      }
      setMessage({ type: "success", text: "Invite sent through Resend." });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not send staff invite.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function sendPasswordReset(id: string, email: string) {
    if (
      !window.confirm(
        `Send a password reset email to ${email}? They'll get a link to choose a new password.`
      )
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "send_password_reset" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send password reset email.");
      }
      setMessage({
        type: "success",
        text: `Password reset email sent to ${email}.`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not send password reset email.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveStaff(id: string) {
    const next = editing[id];
    if (!next) return;

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not update staff user.");
      }
      setMessage({ type: "success", text: "Staff user updated." });
      await loadStaff();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Could not update staff user.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div>
          <h2 className="dash-panel-header-title flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Staff and Roles
          </h2>
          <p className="dash-panel-header-description">
            Invite mosque staff, assign responsibilities, and control who can change sensitive records.
          </p>
        </div>
        <Badge variant="secondary" className="border-dash-border">
          {activeCount} active
        </Badge>
      </div>
      <CardContent className="space-y-6 border-t border-dash-border bg-dash-surface p-5 md:p-6">
        {message && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {message.text}
          </div>
        )}

        <form
          onSubmit={createStaff}
          className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_14rem_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Full name</Label>
              <Input
                id="staff-name"
                value={form.full_name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, full_name: event.target.value }))
                }
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="jane@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <select
                id="staff-role"
                value={form.role}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    role: event.target.value as StaffRole,
                  }))
                }
                className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" variant="primary" disabled={saving}>
              <UserPlus className="mr-2 h-4 w-4" />
              Add Staff
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-dash-text">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-dash-border text-dash-ring focus:ring-dash-ring"
                checked={form.send_invite}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    send_invite: event.target.checked,
                  }))
                }
              />
              <span>
                Email an invite link now
                <span className="ml-2 text-dash-muted">
                  (otherwise just create the record and send later with the Invite button)
                </span>
              </span>
            </label>
            <p className="text-xs leading-5 text-dash-muted">
              Operators are platform-wide. Other roles are scoped to the selected mosque.
            </p>
          </div>
        </form>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ROLE_OPTIONS.map((role) => (
            <div
              key={role.value}
              className="rounded-xl border border-dash-border bg-dash-surface-subtle p-4"
            >
              <p className="text-sm font-semibold text-dash-text">{role.label}</p>
              <p className="mt-1 text-xs leading-5 text-dash-muted">{role.description}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-6">
            <div className="h-5 w-48 animate-pulse rounded bg-dash-border" />
            <div className="mt-4 h-16 animate-pulse rounded-xl bg-dash-border/60" />
          </div>
        ) : staff.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No staff users yet"
            description="Add your secretary, treasurer, charity steward, or membership officer to split access cleanly."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-dash-border">
            <div className="grid grid-cols-[1.4fr_1fr_10rem_8rem_12rem] gap-3 border-b border-dash-border bg-dash-surface-subtle px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
              <span>Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-dash-border">
              {staff.map((member) => {
                const draft = editing[member.id] ?? member;
                return (
                  <div
                    key={member.id}
                    className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1fr_10rem_8rem_12rem] lg:items-center"
                  >
                    <Input
                      value={draft.full_name}
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          [member.id]: { ...draft, full_name: event.target.value },
                        }))
                      }
                    />
                    <p className="truncate text-sm text-dash-muted">{member.email}</p>
                    <select
                      value={draft.role}
                      onChange={(event) =>
                        setEditing((current) => ({
                          ...current,
                          [member.id]: {
                            ...draft,
                            role: event.target.value as StaffRole,
                          },
                        }))
                      }
                      className="flex h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
                    >
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={draft.active}
                      onClick={() =>
                        setEditing((current) => ({
                          ...current,
                          [member.id]: { ...draft, active: !draft.active },
                        }))
                      }
                      className={cn(
                        "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-medium",
                        draft.active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      )}
                    >
                      {draft.active ? "Active" : "Inactive"}
                    </button>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        disabled={saving}
                        onClick={() => sendInvite(member.id)}
                      >
                        <Mail className="mr-1.5 h-4 w-4" />
                        Invite
                      </Button>
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        disabled={saving}
                        onClick={() => sendPasswordReset(member.id, member.email)}
                      >
                        <KeyRound className="mr-1.5 h-4 w-4" />
                        Reset password
                      </Button>
                      <Button
                        type="button"
                        variant="dashboard"
                        size="sm"
                        disabled={saving}
                        onClick={() => saveStaff(member.id)}
                      >
                        <Save className="mr-1.5 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                    <p className="text-xs text-dash-faint lg:col-span-5">
                      {draft.role === "operator"
                        ? "Platform-wide operator access."
                        : `${ROLE_LABELS[draft.role]} for the selected mosque.`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
