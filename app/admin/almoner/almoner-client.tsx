"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  HeartHandshake,
  Loader2,
  Plus,
  RefreshCw,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";

type Member = { id: string; full_name: string; email: string };

type WelfareCase = {
  id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  case_type: string;
  severity: "low" | "standard" | "high" | "urgent";
  status: "open" | "monitoring" | "closed";
  summary: string | null;
  next_action: string | null;
  next_action_due: string | null;
  opened_at: string;
  member_id: string | null;
};

type Alert = {
  id: string;
  member_id: string | null;
  alert_type: "missed_meetings" | "overdue_dues" | "silent" | "manual";
  severity: "low" | "standard" | "high" | "urgent";
  message: string;
  metadata: Record<string, unknown>;
  status: "open" | "snoozed" | "acknowledged" | "resolved";
  created_at: string;
};

type RegisterEntry = {
  id: string;
  register_type: "bereavement" | "widow" | "family";
  full_name: string;
  relationship: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  date_of_event: string | null;
  last_contact_at: string | null;
  notes: string | null;
};

const severityColor: Record<string, "secondary" | "warning" | "destructive"> = {
  low: "secondary",
  standard: "secondary",
  high: "warning",
  urgent: "destructive",
};

export function AlmonerClient({
  cases,
  alerts,
  register,
  members,
}: {
  cases: WelfareCase[];
  alerts: Alert[];
  register: RegisterEntry[];
  members: Member[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newCase, setNewCase] = useState({
    member_id: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    case_type: "general",
    severity: "standard",
    summary: "",
    next_action: "",
    next_action_due: "",
  });
  const [newRegister, setNewRegister] = useState({
    register_type: "bereavement" as RegisterEntry["register_type"],
    full_name: "",
    relationship: "",
    contact_email: "",
    contact_phone: "",
    date_of_event: "",
    notes: "",
  });
  const [newVisit, setNewVisit] = useState<{
    case_id: string;
    contact_method: "visit" | "phone" | "video" | "email" | "letter";
    notes: string;
    follow_up_due: string;
  } | null>(null);
  const [editRegister, setEditRegister] = useState<RegisterEntry | null>(null);

  async function saveRegisterEdit() {
    if (!editRegister) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/welfare/register/${editRegister.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editRegister.full_name,
          relationship: editRegister.relationship,
          contact_email: editRegister.contact_email,
          contact_phone: editRegister.contact_phone,
          last_contact_at: editRegister.last_contact_at,
          notes: editRegister.notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not save register entry.");
      }
      setEditRegister(null);
      setFeedback("Register entry updated.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  const openCases = cases.filter((c) => c.status !== "closed");

  async function regenerateAlerts() {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/welfare/alerts", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to refresh alerts.");
      setFeedback(`Refreshed ${body.generated} care alerts.`);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to refresh.");
    } finally {
      setBusy(false);
    }
  }

  async function createCase(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const member = members.find((m) => m.id === newCase.member_id);
      const payload = {
        ...newCase,
        contact_name:
          newCase.contact_name || member?.full_name || "(unnamed contact)",
        contact_email: newCase.contact_email || member?.email || null,
      };
      const res = await fetch("/api/welfare/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Could not create case.");
      }
      setNewCase({
        member_id: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        case_type: "general",
        severity: "standard",
        summary: "",
        next_action: "",
        next_action_due: "",
      });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create case.");
    } finally {
      setBusy(false);
    }
  }

  async function logVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!newVisit) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/welfare/cases/${newVisit.case_id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_method: newVisit.contact_method,
          notes: newVisit.notes,
          follow_up_due: newVisit.follow_up_due || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Could not log visit.");
      }
      setNewVisit(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not log visit.");
    } finally {
      setBusy(false);
    }
  }

  async function createRegister(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/welfare/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRegister),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Could not add register entry.");
      }
      setNewRegister({
        register_type: "bereavement",
        full_name: "",
        relationship: "",
        contact_email: "",
        contact_phone: "",
        date_of_event: "",
        notes: "",
      });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not add entry.");
    } finally {
      setBusy(false);
    }
  }

  async function actOnAlert(id: string, status: "acknowledged" | "snoozed" | "resolved") {
    setBusy(true);
    try {
      const res = await fetch(`/api/welfare/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Could not update alert.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update alert.");
    } finally {
      setBusy(false);
    }
  }

  async function changeCaseStatus(id: string, status: "open" | "monitoring" | "closed") {
    setBusy(true);
    try {
      const res = await fetch(`/api/welfare/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Could not update case.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not update case.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Almoner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welfare cases, visits log, registers, and care alerts. Permissioned
            so only the almoner and senior officers can see sensitive details.
          </p>
        </div>
        <Button variant="outline" onClick={regenerateAlerts} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh care alerts
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          icon={ShieldAlert}
          label="Open cases"
          value={String(openCases.length)}
          color="red"
        />
        <Kpi
          icon={Bell}
          label="Open care alerts"
          value={String(alerts.length)}
          color="amber"
        />
        <Kpi
          icon={HeartHandshake}
          label="Register entries"
          value={String(register.length)}
          color="blue"
        />
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <Tabs defaultValue="cases">
        <TabsList>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="alerts">Care alerts</TabsTrigger>
          <TabsTrigger value="register">Registers</TabsTrigger>
          <TabsTrigger value="new-case">New case</TabsTrigger>
        </TabsList>

        <TabsContent value="cases">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      No welfare cases yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell className="text-sm">
                        <Link
                          href={`/admin/almoner/cases/${c.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700"
                        >
                          {c.contact_name}
                        </Link>
                        {c.contact_phone && (
                          <p className="text-xs text-slate-500">
                            {c.contact_phone}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-xs uppercase tracking-wider text-slate-500">
                        {c.case_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityColor[c.severity] ?? "secondary"} className="capitalize">
                          {c.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.next_action ? (
                          <>
                            <p className="text-slate-700">{c.next_action}</p>
                            {c.next_action_due && (
                              <p className="text-slate-500">
                                Due {new Date(c.next_action_due).toLocaleDateString("en-GB")}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={c.status === "closed" ? "secondary" : c.status === "monitoring" ? "warning" : "destructive"}
                          className="capitalize"
                        >
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/admin/almoner/cases/${c.id}`}>
                              <ExternalLink className="mr-1 h-3 w-3" /> Open
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setNewVisit({
                                case_id: c.id,
                                contact_method: "visit",
                                notes: "",
                                follow_up_due: "",
                              })
                            }
                          >
                            <Plus className="mr-1 h-3 w-3" /> Visit
                          </Button>
                          {c.status !== "closed" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => changeCaseStatus(c.id, "closed")}
                            >
                              Close
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => changeCaseStatus(c.id, "open")}
                            >
                              Reopen
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead className="w-56 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      No open care alerts. Refresh to scan for new ones.
                    </TableCell>
                  </TableRow>
                ) : (
                  alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="text-sm text-slate-700">
                        {alert.message}
                      </TableCell>
                      <TableCell className="text-xs uppercase tracking-wider text-slate-500">
                        {alert.alert_type.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={severityColor[alert.severity] ?? "secondary"} className="capitalize">
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => actOnAlert(alert.id, "acknowledged")}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => actOnAlert(alert.id, "snoozed")}
                          >
                            Snooze
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="register" className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Add register entry
            </h2>
            <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={createRegister}>
              <Field label="Register">
                <select
                  value={newRegister.register_type}
                  onChange={(e) =>
                    setNewRegister((f) => ({
                      ...f,
                      register_type: e.target.value as RegisterEntry["register_type"],
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="bereavement">Bereavement</option>
                  <option value="widow">Widow</option>
                  <option value="family">Family</option>
                </select>
              </Field>
              <Field label="Full name">
                <Input
                  value={newRegister.full_name}
                  onChange={(v) => setNewRegister((f) => ({ ...f, full_name: v }))}
                  required
                />
              </Field>
              <Field label="Relationship">
                <Input
                  value={newRegister.relationship}
                  onChange={(v) => setNewRegister((f) => ({ ...f, relationship: v }))}
                />
              </Field>
              <Field label="Date of event">
                <input
                  type="date"
                  value={newRegister.date_of_event}
                  onChange={(e) =>
                    setNewRegister((f) => ({ ...f, date_of_event: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Email">
                <Input
                  value={newRegister.contact_email}
                  onChange={(v) => setNewRegister((f) => ({ ...f, contact_email: v }))}
                />
              </Field>
              <Field label="Phone">
                <Input
                  value={newRegister.contact_phone}
                  onChange={(v) => setNewRegister((f) => ({ ...f, contact_phone: v }))}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={newRegister.notes}
                    onChange={(e) =>
                      setNewRegister((f) => ({ ...f, notes: e.target.value }))
                    }
                    rows={2}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 text-right">
                <Button type="submit" disabled={busy}>
                  <UserPlus className="mr-2 h-4 w-4" /> Add to register
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Register</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Last contact</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {register.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      No register entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  register.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-xs uppercase tracking-wider text-slate-500">
                        {entry.register_type}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {entry.full_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {entry.relationship ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {entry.date_of_event
                          ? new Date(entry.date_of_event).toLocaleDateString("en-GB")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {entry.last_contact_at
                          ? new Date(entry.last_contact_at).toLocaleDateString("en-GB")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditRegister(entry)}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="new-case">
          <form
            onSubmit={createCase}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Open welfare case
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Member (optional)">
                <select
                  value={newCase.member_id}
                  onChange={(e) =>
                    setNewCase((f) => ({ ...f, member_id: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">— Other / family contact —</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Case type">
                <select
                  value={newCase.case_type}
                  onChange={(e) =>
                    setNewCase((f) => ({ ...f, case_type: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="general">General</option>
                  <option value="illness">Illness</option>
                  <option value="bereavement">Bereavement</option>
                  <option value="financial">Financial</option>
                  <option value="family">Family</option>
                  <option value="isolation">Isolation</option>
                </select>
              </Field>
              <Field label="Contact name (override)">
                <Input
                  value={newCase.contact_name}
                  onChange={(v) => setNewCase((f) => ({ ...f, contact_name: v }))}
                />
              </Field>
              <Field label="Severity">
                <select
                  value={newCase.severity}
                  onChange={(e) =>
                    setNewCase((f) => ({ ...f, severity: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Phone">
                <Input
                  value={newCase.contact_phone}
                  onChange={(v) => setNewCase((f) => ({ ...f, contact_phone: v }))}
                />
              </Field>
              <Field label="Email">
                <Input
                  value={newCase.contact_email}
                  onChange={(v) => setNewCase((f) => ({ ...f, contact_email: v }))}
                />
              </Field>
              <Field label="Next action">
                <Input
                  value={newCase.next_action}
                  onChange={(v) => setNewCase((f) => ({ ...f, next_action: v }))}
                />
              </Field>
              <Field label="Next action due">
                <input
                  type="date"
                  value={newCase.next_action_due}
                  onChange={(e) =>
                    setNewCase((f) => ({ ...f, next_action_due: e.target.value }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Summary">
                  <textarea
                    value={newCase.summary}
                    onChange={(e) =>
                      setNewCase((f) => ({ ...f, summary: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 text-right">
              <Button type="submit" disabled={busy}>
                <ClipboardList className="mr-2 h-4 w-4" /> Open case
              </Button>
            </div>
          </form>
        </TabsContent>
      </Tabs>

      {newVisit && (
        <div className="admin-modal-backdrop">
          <form
            onSubmit={logVisit}
            className="admin-modal-panel-sm"
          >
            <h3 className="text-base font-semibold text-slate-900">Log a visit</h3>
            <div className="mt-3 space-y-3">
              <Field label="Method">
                <select
                  value={newVisit.contact_method}
                  onChange={(e) =>
                    setNewVisit((v) =>
                      v
                        ? {
                            ...v,
                            contact_method: e.target.value as
                              | "visit"
                              | "phone"
                              | "video"
                              | "email"
                              | "letter",
                          }
                        : v
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="visit">In-person visit</option>
                  <option value="phone">Phone call</option>
                  <option value="video">Video call</option>
                  <option value="email">Email</option>
                  <option value="letter">Letter</option>
                </select>
              </Field>
              <Field label="Notes">
                <textarea
                  value={newVisit.notes}
                  onChange={(e) =>
                    setNewVisit((v) => (v ? { ...v, notes: e.target.value } : v))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
              <Field label="Follow-up due">
                <input
                  type="date"
                  value={newVisit.follow_up_due}
                  onChange={(e) =>
                    setNewVisit((v) =>
                      v ? { ...v, follow_up_due: e.target.value } : v
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setNewVisit(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Log visit
              </Button>
            </div>
          </form>
        </div>
      )}

      {editRegister && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal-panel-md">
            <h3 className="text-base font-semibold text-slate-900">
              Edit register entry
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <input
                  value={editRegister.full_name}
                  onChange={(e) =>
                    setEditRegister({ ...editRegister, full_name: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Relationship">
                <input
                  value={editRegister.relationship ?? ""}
                  onChange={(e) =>
                    setEditRegister({
                      ...editRegister,
                      relationship: e.target.value || null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Contact email">
                <input
                  type="email"
                  value={editRegister.contact_email ?? ""}
                  onChange={(e) =>
                    setEditRegister({
                      ...editRegister,
                      contact_email: e.target.value || null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Contact phone">
                <input
                  value={editRegister.contact_phone ?? ""}
                  onChange={(e) =>
                    setEditRegister({
                      ...editRegister,
                      contact_phone: e.target.value || null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Last contact date">
                <input
                  type="date"
                  value={
                    editRegister.last_contact_at
                      ? editRegister.last_contact_at.slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setEditRegister({
                      ...editRegister,
                      last_contact_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <textarea
                    value={editRegister.notes ?? ""}
                    rows={3}
                    onChange={(e) =>
                      setEditRegister({
                        ...editRegister,
                        notes: e.target.value || null,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditRegister(null)}
              >
                Cancel
              </Button>
              <Button onClick={saveRegisterEdit} disabled={busy}>
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
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

function Input({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
    />
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "red" | "amber" | "blue";
}) {
  const map = {
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${map[color]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
