"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type ArchiveStrategy = "soft_delete" | "anonymise" | "hard_delete";

type Settings = {
  resigned_member_retention_months: number;
  deceased_member_retention_months: number;
  newcomer_inactive_retention_months: number;
  audit_log_retention_months: number;
  archive_strategy: ArchiveStrategy;
  notes: string | null;
} | null;

type Sar = {
  id: string;
  requester_email: string;
  requester_name: string | null;
  status: "received" | "in_progress" | "fulfilled" | "rejected";
  created_at: string;
  fulfilled_at: string | null;
  delivery_method: string | null;
};

export function ComplianceClient({
  role,
  mfaEnabled,
  mfaEnrolledAt,
  settings,
  sars,
}: {
  role: string;
  mfaEnabled: boolean;
  mfaEnrolledAt: string | null;
  settings: Settings;
  sars: Sar[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    resigned_member_retention_months:
      settings?.resigned_member_retention_months ?? 84,
    deceased_member_retention_months:
      settings?.deceased_member_retention_months ?? 240,
    newcomer_inactive_retention_months:
      settings?.newcomer_inactive_retention_months ?? 24,
    audit_log_retention_months: settings?.audit_log_retention_months ?? 84,
    archive_strategy: settings?.archive_strategy ?? "soft_delete",
    notes: settings?.notes ?? "",
  });
  const [mfaSetup, setMfaSetup] = useState<{
    qrDataUrl: string;
    backupCodes: string[];
  } | null>(null);
  const [verifyToken, setVerifyToken] = useState("");
  const [confirmDisableMfaOpen, setConfirmDisableMfaOpen] = useState(false);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setBusy("settings");
    try {
      const res = await fetch("/api/data-retention", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Could not save settings.");
      setFeedback("Retention settings saved.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function startMfa() {
    setBusy("mfa-setup");
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      if (!res.ok) throw new Error("Could not start MFA setup.");
      const data = await res.json();
      setMfaSetup({
        qrDataUrl: data.qrDataUrl,
        backupCodes: data.backupCodes,
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Setup failed.");
    } finally {
      setBusy(null);
    }
  }

  async function verifyMfa() {
    setBusy("mfa-verify");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });
      if (!res.ok) throw new Error("Could not verify code.");
      setMfaSetup(null);
      setVerifyToken("");
      setFeedback("Two-factor authentication enabled.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Verify failed.");
    } finally {
      setBusy(null);
    }
  }

  async function disableMfa() {
    setBusy("mfa-disable");
    try {
      const res = await fetch("/api/auth/mfa/verify", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not disable MFA.");
      setFeedback("Two-factor authentication disabled.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Disable failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance &amp; trust</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage GDPR retention, subject access requests and admin
          two-factor authentication. Logged in as <Badge variant="secondary">{role}</Badge>
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <Tabs defaultValue="retention">
        <TabsList>
          <TabsTrigger value="retention">Data retention</TabsTrigger>
          <TabsTrigger value="sars">Subject access</TabsTrigger>
          <TabsTrigger value="mfa">Two-factor auth</TabsTrigger>
        </TabsList>

        <TabsContent value="retention">
          <form
            onSubmit={saveSettings}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Retention policy
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Times are in months. Leave at the recommended defaults if you are
              unsure. Archive strategy controls how members are handled when
              they become resigned, excluded, or deceased.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Resigned member retention (months)">
                <NumberInput
                  value={form.resigned_member_retention_months}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, resigned_member_retention_months: v }))
                  }
                />
              </Field>
              <Field label="Deceased member retention (months)">
                <NumberInput
                  value={form.deceased_member_retention_months}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, deceased_member_retention_months: v }))
                  }
                />
              </Field>
              <Field label="Inactive newcomer retention (months)">
                <NumberInput
                  value={form.newcomer_inactive_retention_months}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, newcomer_inactive_retention_months: v }))
                  }
                />
              </Field>
              <Field label="Audit log retention (months)">
                <NumberInput
                  value={form.audit_log_retention_months}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, audit_log_retention_months: v }))
                  }
                />
              </Field>
              <Field label="Archive strategy">
                <select
                  value={form.archive_strategy}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      archive_strategy: e.target.value as ArchiveStrategy,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="soft_delete">Soft delete (hide)</option>
                  <option value="anonymise">Anonymise (PII removed)</option>
                  <option value="hard_delete">Hard delete (irreversible)</option>
                </select>
              </Field>
              <Field label="Notes">
                <input
                  value={form.notes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3 text-right">
              <Button type="submit" disabled={busy === "settings"}>
                {busy === "settings" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save policy
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="sars" className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Subject access requests
              </h2>
              <p className="text-xs text-slate-500">
                You can also generate a SAR export from any member detail page.
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Requested</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fulfilled</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sars.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-slate-500">
                      No subject access requests recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  sars.map((sar) => (
                    <TableRow key={sar.id}>
                      <TableCell className="text-xs text-slate-500">
                        {new Date(sar.created_at).toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p>{sar.requester_email}</p>
                        {sar.requester_name && (
                          <p className="text-xs text-slate-500">
                            {sar.requester_name}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sar.status === "fulfilled" ? "secondary" : "outline"}>
                          {sar.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {sar.fulfilled_at
                          ? new Date(sar.fulfilled_at).toLocaleDateString("en-GB")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {sar.delivery_method ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="mfa" className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Two-factor authentication
                </h2>
                <p className="text-xs text-slate-500">
                  Use an authenticator app (1Password, Authy, Google Authenticator)
                  to add a second factor when signing in.
                </p>
              </div>
              {mfaEnabled ? (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Enabled
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  <ShieldAlert className="mr-1 h-3 w-3" /> Not enabled
                </Badge>
              )}
            </div>
            {mfaEnrolledAt && (
              <p className="mt-2 text-xs text-slate-500">
                Enrolled {new Date(mfaEnrolledAt).toLocaleDateString("en-GB")}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!mfaEnabled && !mfaSetup && (
                <Button onClick={startMfa} disabled={busy === "mfa-setup"}>
                  {busy === "mfa-setup" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="mr-2 h-4 w-4" />
                  )}
                  Set up authenticator
                </Button>
              )}
              {mfaEnabled && (
                <Button
                  variant="outline"
                    onClick={() => setConfirmDisableMfaOpen(true)}
                  disabled={busy === "mfa-disable"}
                >
                  Disable MFA
                </Button>
              )}
            </div>

            {mfaSetup && (
              <div className="mt-5 grid gap-5 sm:grid-cols-[auto,1fr]">
                <div>
                  <Image
                    src={mfaSetup.qrDataUrl}
                    alt="MFA QR code"
                    width={180}
                    height={180}
                    unoptimized
                    className="rounded-lg border border-slate-200 p-2"
                  />
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-slate-700">
                    1. Scan the QR with your authenticator app.<br />
                    2. Enter the 6-digit code below to confirm.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="123456"
                      className="h-10 w-32 rounded-lg border border-slate-200 px-3 font-mono text-sm tracking-widest"
                    />
                    <Button onClick={verifyMfa} disabled={busy === "mfa-verify"}>
                      {busy === "mfa-verify" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Verify
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      Backup codes (store securely):
                    </p>
                    <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-xs text-slate-700">
                      {mfaSetup.backupCodes.map((code) => (
                        <span
                          key={code}
                          className="rounded bg-slate-100 px-2 py-1"
                        >
                          {code}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <ConfirmActionDialog
        open={confirmDisableMfaOpen}
        onOpenChange={setConfirmDisableMfaOpen}
        title="Disable two-factor authentication?"
        description="This removes the extra sign-in protection from your admin account."
        confirmLabel="Disable two-factor"
        tone="danger"
        loading={busy === "mfa-disable"}
        onConfirm={async () => {
          await disableMfa();
          setConfirmDisableMfaOpen(false);
        }}
      />
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

function NumberInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
    />
  );
}
