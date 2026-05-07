"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  User,
  X,
} from "lucide-react";

type WelfareCase = {
  id: string;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  case_type: "general" | "illness" | "bereavement" | "financial" | "family" | "isolation";
  severity: "low" | "standard" | "high" | "urgent";
  status: "open" | "monitoring" | "closed";
  summary: string | null;
  next_action: string | null;
  next_action_due: string | null;
  member_id: string | null;
  opened_at: string;
  closed_at: string | null;
};

type Visit = {
  id: string;
  visited_at: string;
  contact_method: "visit" | "phone" | "video" | "email" | "letter";
  outcome: string | null;
  notes: string | null;
  follow_up_due: string | null;
};

type Member = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  actor_email: string | null;
  summary: string | null;
  created_at: string;
};

type Alert = {
  id: string;
  alert_type: "missed_meetings" | "overdue_dues" | "silent" | "manual";
  severity: "low" | "standard" | "high" | "urgent";
  message: string;
  status: "open" | "snoozed" | "acknowledged" | "resolved";
  created_at: string;
};

const SEVERITY_TONE: Record<
  WelfareCase["severity"],
  "secondary" | "warning" | "destructive"
> = {
  low: "secondary",
  standard: "secondary",
  high: "warning",
  urgent: "destructive",
};

const STATUS_TONE: Record<
  WelfareCase["status"],
  "success" | "warning" | "destructive"
> = {
  open: "destructive",
  monitoring: "warning",
  closed: "success",
};

export function CaseDetailClient({
  welfareCase: initial,
  visits: initialVisits,
  member,
  auditLogs,
  relatedAlerts,
}: {
  welfareCase: WelfareCase;
  visits: Visit[];
  member: Member | null;
  auditLogs: AuditLog[];
  relatedAlerts: Alert[];
}) {
  const router = useRouter();
  const [welfareCase, setWelfareCase] = useState(initial);
  const [visits, setVisits] = useState(initialVisits);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showVisit, setShowVisit] = useState(false);
  const [visitDraft, setVisitDraft] = useState({
    contact_method: "visit" as Visit["contact_method"],
    notes: "",
    outcome: "",
    follow_up_due: "",
  });

  async function patch(updates: Partial<WelfareCase>) {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/welfare/cases/${welfareCase.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save.");
      setWelfareCase(body.case);
      setFeedback("Saved.");
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function logVisit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/welfare/cases/${welfareCase.id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_method: visitDraft.contact_method,
          notes: visitDraft.notes || null,
          outcome: visitDraft.outcome || null,
          follow_up_due: visitDraft.follow_up_due || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not log visit.");
      setVisits((v) => [body.visit, ...v]);
      setShowVisit(false);
      setVisitDraft({
        contact_method: "visit",
        notes: "",
        outcome: "",
        follow_up_due: "",
      });
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not log visit.");
    } finally {
      setBusy(false);
    }
  }

  async function actOnAlert(id: string, status: "acknowledged" | "snoozed" | "resolved") {
    try {
      const res = await fetch(`/api/welfare/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Could not update alert.");
      router.refresh();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not update alert.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="admin-page-head">
        <div className="min-w-0 flex-1">
          <h1 className="admin-page-title flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-rose-600" />
            {welfareCase.contact_name}
          </h1>
          <p className="admin-page-copy capitalize">
            {welfareCase.case_type} · opened {formatDate(welfareCase.opened_at)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/almoner" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to almoner
          </Link>
        </Button>
      </div>

      {feedback ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card variant="panel" className="space-y-4 p-5">
            <h2 className="text-base font-semibold text-dash-text">Case</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name">
                <input
                  className={INPUT_CLASS}
                  defaultValue={welfareCase.contact_name}
                  onBlur={(e) =>
                    e.target.value !== welfareCase.contact_name &&
                    patch({ contact_name: e.target.value })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Status">
                <select
                  className={INPUT_CLASS}
                  value={welfareCase.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as WelfareCase["status"] })
                  }
                  disabled={busy}
                >
                  <option value="open">Open</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="closed">Closed</option>
                </select>
              </Field>
              <Field label="Severity">
                <select
                  className={INPUT_CLASS}
                  value={welfareCase.severity}
                  onChange={(e) =>
                    patch({ severity: e.target.value as WelfareCase["severity"] })
                  }
                  disabled={busy}
                >
                  <option value="low">Low</option>
                  <option value="standard">Standard</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </Field>
              <Field label="Case type">
                <select
                  className={INPUT_CLASS}
                  value={welfareCase.case_type}
                  onChange={(e) =>
                    patch({ case_type: e.target.value as WelfareCase["case_type"] })
                  }
                  disabled={busy}
                >
                  <option value="general">General</option>
                  <option value="illness">Illness</option>
                  <option value="bereavement">Bereavement</option>
                  <option value="financial">Financial</option>
                  <option value="family">Family</option>
                  <option value="isolation">Isolation</option>
                </select>
              </Field>
              <Field label="Phone">
                <input
                  className={INPUT_CLASS}
                  defaultValue={welfareCase.contact_phone ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (welfareCase.contact_phone ?? "") &&
                    patch({ contact_phone: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={INPUT_CLASS}
                  defaultValue={welfareCase.contact_email ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (welfareCase.contact_email ?? "") &&
                    patch({ contact_email: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Next action">
                <input
                  className={INPUT_CLASS}
                  defaultValue={welfareCase.next_action ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (welfareCase.next_action ?? "") &&
                    patch({ next_action: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
              <Field label="Next action due">
                <input
                  type="date"
                  className={INPUT_CLASS}
                  defaultValue={welfareCase.next_action_due?.slice(0, 10) ?? ""}
                  onBlur={(e) =>
                    e.target.value !== (welfareCase.next_action_due?.slice(0, 10) ?? "") &&
                    patch({ next_action_due: e.target.value || null })
                  }
                  disabled={busy}
                />
              </Field>
            </div>
            <Field label="Summary">
              <textarea
                rows={4}
                className="min-h-[120px] w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
                defaultValue={welfareCase.summary ?? ""}
                onBlur={(e) =>
                  e.target.value !== (welfareCase.summary ?? "") &&
                  patch({ summary: e.target.value || null })
                }
                disabled={busy}
              />
            </Field>
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
                <Clock className="h-4 w-4 text-dash-muted" /> Visits and notes
              </h2>
              <Button
                size="sm"
                onClick={() => setShowVisit((v) => !v)}
                disabled={busy}
              >
                {showVisit ? (
                  <>
                    <X className="mr-2 h-4 w-4" /> Cancel
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" /> Log visit / note
                  </>
                )}
              </Button>
            </div>

            {showVisit ? (
              <form
                onSubmit={logVisit}
                className="space-y-3 rounded-xl border border-dash-border bg-dash-surface-subtle p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Method">
                    <select
                      className={INPUT_CLASS}
                      value={visitDraft.contact_method}
                      onChange={(e) =>
                        setVisitDraft((d) => ({
                          ...d,
                          contact_method: e.target.value as Visit["contact_method"],
                        }))
                      }
                    >
                      <option value="visit">In-person visit</option>
                      <option value="phone">Phone call</option>
                      <option value="video">Video call</option>
                      <option value="email">Email</option>
                      <option value="letter">Letter</option>
                    </select>
                  </Field>
                  <Field label="Follow-up due">
                    <input
                      type="date"
                      className={INPUT_CLASS}
                      value={visitDraft.follow_up_due}
                      onChange={(e) =>
                        setVisitDraft((d) => ({
                          ...d,
                          follow_up_due: e.target.value,
                        }))
                      }
                    />
                  </Field>
                </div>
                <Field label="Outcome (optional)">
                  <input
                    className={INPUT_CLASS}
                    value={visitDraft.outcome}
                    onChange={(e) =>
                      setVisitDraft((d) => ({ ...d, outcome: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    rows={3}
                    className="min-h-[80px] w-full rounded-lg border border-dash-border bg-dash-surface px-3 py-2 text-sm text-dash-text"
                    value={visitDraft.notes}
                    onChange={(e) =>
                      setVisitDraft((d) => ({ ...d, notes: e.target.value }))
                    }
                    required
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowVisit(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={busy}>
                    {busy ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
              </form>
            ) : null}

            {visits.length === 0 ? (
              <p className="text-sm text-dash-text-muted">
                No visits logged yet. Log the first visit to start the timeline.
              </p>
            ) : (
              <ul className="space-y-3">
                {visits.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-xl border border-dash-border bg-dash-surface-subtle/40 p-3"
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium capitalize text-dash-text">
                        {v.contact_method}
                      </span>
                      <span className="text-xs text-dash-text-muted">
                        {formatDate(v.visited_at)}
                      </span>
                    </div>
                    {v.outcome ? (
                      <p className="mt-1 text-xs uppercase tracking-wider text-dash-muted">
                        {v.outcome}
                      </p>
                    ) : null}
                    {v.notes ? (
                      <p className="mt-2 whitespace-pre-line text-sm text-dash-text">
                        {v.notes}
                      </p>
                    ) : null}
                    {v.follow_up_due ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Follow up by {formatDate(v.follow_up_due)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
              <Clock className="h-4 w-4 text-dash-muted" /> Audit history
            </h2>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-dash-text-muted">No audit events yet.</p>
            ) : (
              <ul className="divide-y divide-dash-border">
                {auditLogs.map((log) => (
                  <li key={log.id} className="py-2 text-sm">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-dash-text">
                        {log.action.replaceAll("_", " ")}
                      </span>
                      <span className="text-xs text-dash-text-muted">
                        {formatDate(log.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-dash-text-muted">
                      {log.actor_email ?? "system"}
                      {log.summary ? ` · ${log.summary}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card variant="panel" className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-dash-text">Status</h2>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant={STATUS_TONE[welfareCase.status]}
                className="capitalize"
              >
                {welfareCase.status}
              </Badge>
              <Badge
                variant={SEVERITY_TONE[welfareCase.severity]}
                className="capitalize"
              >
                {welfareCase.severity}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={busy}
              onClick={() =>
                patch({
                  status: welfareCase.status === "closed" ? "open" : "closed",
                })
              }
            >
              {welfareCase.status === "closed" ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Reopen case
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Close case
                </>
              )}
            </Button>
          </Card>

          {member ? (
            <Card variant="panel" className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
                <User className="h-4 w-4" /> Member
              </h2>
              <p className="font-medium text-dash-text">{member.full_name}</p>
              <p className="flex items-center gap-2 text-sm text-dash-text-muted">
                <Mail className="h-3.5 w-3.5" /> {member.email}
              </p>
              {member.phone ? (
                <p className="flex items-center gap-2 text-sm text-dash-text-muted">
                  <Phone className="h-3.5 w-3.5" /> {member.phone}
                </p>
              ) : null}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/admin/members/${member.id}`}>Open member</Link>
              </Button>
            </Card>
          ) : null}

          {relatedAlerts.length > 0 ? (
            <Card variant="panel" className="space-y-3 p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold text-dash-text">
                <Bell className="h-4 w-4 text-amber-600" /> Care alerts
              </h2>
              <ul className="space-y-2">
                {relatedAlerts.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-dash-border p-3 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-dash-text">{a.message}</p>
                        <p className="mt-1 text-xs text-dash-text-muted capitalize">
                          {a.alert_type.replaceAll("_", " ")} · {a.severity}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => actOnAlert(a.id, "acknowledged")}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => actOnAlert(a.id, "resolved")}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-dash-border bg-dash-surface px-3 text-sm text-dash-text focus:border-dash-ring focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-dash-text-muted">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
