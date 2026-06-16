"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Send, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type MosqueOption = {
  id: string;
  name: string;
  slug: string;
  mosque_number: string | null;
  network_id: string | null;
};

type NetworkOption = {
  id: string;
  name: string;
};

type AdminUser = {
  id: string;
  mosque_id: string | null;
  email: string;
  full_name: string;
  role: string;
  active: boolean;
};

type ScopeType = "mosque" | "network" | "platform";

const TENANT_ROLES = [
  ["super_admin", "Tenant owner"],
  ["secretary", "Secretary"],
  ["treasurer", "Treasurer"],
  ["charity_steward", "Charity Steward"],
  ["membership_officer", "Membership Officer"],
  ["pastoral_care", "PastoralCare"],
  ["master", "Master"],
];

const PLATFORM_ROLES = [
  ["operator", "Platform team"],
  ["super_admin", "Platform owner"],
];

export function PlatformConsoleManager({
  mosques,
  networks,
  tenantAdmins,
  platformAdmins,
  isOwner,
}: {
  mosques: MosqueOption[];
  networks: NetworkOption[];
  tenantAdmins: AdminUser[];
  platformAdmins: AdminUser[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scopeType, setScopeType] = useState<ScopeType>("mosque");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "super_admin",
    mosque_id: mosques[0]?.id ?? "",
    network_id: networks[0]?.id ?? "",
    send_invite: false,
  });

  const mosqueById = useMemo(
    () => new Map(mosques.map((mosque) => [mosque.id, mosque])),
    [mosques]
  );

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const requestedInvite = form.send_invite;
    try {
      const res = await fetch("/api/admin/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope_type: scopeType,
          full_name: form.full_name,
          email: form.email,
          role: form.role,
          mosque_id: form.mosque_id || null,
          network_id: form.network_id || null,
          send_invite: form.send_invite,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not save admin.");
      let inviteText = "Admin record saved. Use the Invite button to email an access link.";
      if (requestedInvite) {
        inviteText = data.invite?.sent
          ? "Admin saved and invite email sent."
          : `Admin saved. Invite email was not sent: ${data.invite?.error ?? "unknown error"}`;
      }
      setMessage(inviteText);
      setForm((prev) => ({ ...prev, full_name: "", email: "" }));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save admin.");
    } finally {
      setBusy(false);
    }
  }

  const roleOptions = scopeType === "platform" ? PLATFORM_ROLES : TENANT_ROLES;

  async function sendPasswordReset(admin: AdminUser) {
    if (
      !window.confirm(
        `Send a password reset email to ${admin.email}? They'll get a link to choose a new password.`
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/platform/admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, action: "send_password_reset" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send password reset email.");
      }
      setMessage(`Password reset email sent to ${admin.email}.`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not send password reset email."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card variant="panel" className="p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-dash-surface-subtle p-2 text-dash-ring">
            <UserPlus className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-base font-semibold text-dash-text">
              Invite an admin owner
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-dash-muted">
              Add an owner to one mosque, every mosque in a network, or the
              MosquePay platform team. Platform team invites are owner-only.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["mosque", "network", "platform"] as const).map((value) => (
              <button
                key={value}
                type="button"
                disabled={value === "platform" && !isOwner}
                onClick={() => {
                  setScopeType(value);
                  setForm((prev) => ({
                    ...prev,
                    role: value === "platform" ? "operator" : "super_admin",
                  }));
                }}
                className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                  scopeType === value
                    ? "border-dash-ring bg-dash-ring/10 text-dash-ring"
                    : "border-dash-border bg-dash-surface text-dash-muted"
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {value === "mosque"
                  ? "Mosque"
                  : value === "network"
                    ? "Network"
                    : "Platform team"}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="platform-admin-name">Full name</Label>
              <Input
                id="platform-admin-name"
                value={form.full_name}
                onChange={(event) => setField("full_name", event.target.value)}
                required
                variant="dashboard"
              />
            </div>
            <div>
              <Label htmlFor="platform-admin-email">Email</Label>
              <Input
                id="platform-admin-email"
                type="email"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                required
                variant="dashboard"
              />
            </div>
          </div>

          {scopeType === "mosque" ? (
            <SelectField
              id="platform-admin-mosque"
              label="Tenant mosque"
              value={form.mosque_id}
              onChange={(value) => setField("mosque_id", value)}
            >
              {mosques.map((mosque) => (
                <option key={mosque.id} value={mosque.id}>
                  {mosque.name}
                  {mosque.mosque_number ? ` No ${mosque.mosque_number}` : ""}
                </option>
              ))}
            </SelectField>
          ) : null}

          {scopeType === "network" ? (
            <SelectField
              id="platform-admin-network"
              label="Network"
              value={form.network_id}
              onChange={(value) => setField("network_id", value)}
            >
              {networks.map((network) => (
                <option key={network.id} value={network.id}>
                  {network.name}
                </option>
              ))}
            </SelectField>
          ) : null}

          <SelectField
            id="platform-admin-role"
            label="Role"
            value={form.role}
            onChange={(value) => setField("role", value)}
          >
            {roleOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle px-3 py-3 text-sm text-dash-text">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-dash-border text-dash-ring focus:ring-dash-ring"
              checked={form.send_invite}
              onChange={(event) => setField("send_invite", event.target.checked)}
            />
            <span>
              Email an invite link now
              <span className="ml-2 text-dash-muted">
                (otherwise just save the record. You can email the invite later.)
              </span>
            </span>
          </label>

          {message ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              {message}
            </div>
          ) : null}

          <Button type="submit" disabled={busy || (scopeType === "platform" && !isOwner)}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {form.send_invite ? "Save and invite" : "Save"}
          </Button>
        </form>
      </Card>

      <Card variant="panel" className="overflow-hidden">
        <div className="border-b border-dash-border bg-dash-surface-subtle p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-dash-ring" aria-hidden />
            <h2 className="text-base font-semibold text-dash-text">
              Current platform and tenant admins
            </h2>
          </div>
          <p className="mt-1 text-sm text-dash-muted">
            Platform team members can manage tenants. Tenant owners are scoped
            to their mosque memberships.
          </p>
        </div>
        <div className="max-h-[32rem] overflow-auto p-5">
          <AdminList
            title="Platform team"
            rows={platformAdmins}
            getScope={() => "Platform"}
            onResetPassword={sendPasswordReset}
            busy={busy}
          />
          <AdminList
            title="Tenant admins"
            rows={tenantAdmins}
            getScope={(admin) => mosqueById.get(admin.mosque_id ?? "")?.name ?? "Unknown mosque"}
            onResetPassword={sendPasswordReset}
            busy={busy}
          />
        </div>
      </Card>
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-11 w-full rounded-xl border border-dash-border bg-dash-surface px-4 py-2 text-sm text-dash-text shadow-sm focus-visible:border-dash-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring/20"
      >
        {children}
      </select>
    </div>
  );
}

function AdminList({
  title,
  rows,
  getScope,
  onResetPassword,
  busy,
}: {
  title: string;
  rows: AdminUser[];
  getScope: (admin: AdminUser) => string;
  onResetPassword: (admin: AdminUser) => void;
  busy: boolean;
}) {
  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-dash-muted">No admins yet.</p>
      ) : (
        <div className="mt-3 divide-y divide-dash-border rounded-xl border border-dash-border">
          {rows.map((admin) => (
            <div
              key={admin.id}
              className="grid gap-2 p-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)_auto_auto]"
            >
              <div>
                <p className="font-medium text-dash-text">{admin.full_name}</p>
                <p className="text-dash-muted">{admin.email}</p>
              </div>
              <div className="text-dash-muted">
                <p>{getScope(admin)}</p>
                <p className="capitalize">{admin.role.replaceAll("_", " ")}</p>
              </div>
              <span
                className={`self-start rounded-full px-2 py-1 text-xs font-medium ${
                  admin.active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {admin.active ? "Active" : "Inactive"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy || !admin.active}
                onClick={() => onResetPassword(admin)}
                className="self-start"
              >
                <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                Reset password
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
