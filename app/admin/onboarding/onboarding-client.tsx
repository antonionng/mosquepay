"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Send,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  KNOWN_HEADERS,
  buildImportPayload,
  parseMembersCsv,
  type ParsedMemberRow,
} from "@/lib/members/csv";

type Counts = {
  members: number;
  dues: number;
  events: number;
  staff: number;
};

type StepId = "intro" | "members" | "dues" | "summons" | "staff" | "done";

const STEPS: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "intro",
    title: "Welcome",
    description: "A 15 minute setup to get your lodge live.",
  },
  {
    id: "members",
    title: "Import members",
    description: "Upload a CSV of your roll book.",
  },
  {
    id: "dues",
    title: "Annual dues",
    description: "Generate this year's dues for every active member.",
  },
  {
    id: "summons",
    title: "First summons",
    description: "Schedule your next regular meeting.",
  },
  {
    id: "staff",
    title: "Officer access",
    description: "Invite your secretary, treasurer, and almoner.",
  },
  { id: "done", title: "All done", description: "You are live." },
];

function Stepper({
  current,
  completed,
}: {
  current: StepId;
  completed: Set<StepId>;
}) {
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((step, idx) => {
        const isCurrent = step.id === current;
        const isDone = completed.has(step.id);
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              className={[
                "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                isCurrent
                  ? "border-blue-600 bg-blue-600 text-white"
                  : isDone
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-300 bg-white text-slate-500",
              ].join(" ")}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
            </span>
            <span
              className={[
                "text-sm",
                isCurrent ? "font-semibold text-slate-900" : "text-slate-500",
              ].join(" ")}
            >
              {step.title}
            </span>
            {idx < STEPS.length - 1 && (
              <span className="hidden text-slate-300 sm:inline">/</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingWizard({
  lodgeSlug,
  lodgeName,
  counts,
}: {
  lodgeSlug: string;
  lodgeName: string;
  counts: Counts;
}) {
  const router = useRouter();
  const initialCompleted = useMemo(() => {
    const set = new Set<StepId>(["intro"]);
    if (counts.members > 0) set.add("members");
    if (counts.dues > 0) set.add("dues");
    if (counts.events > 0) set.add("summons");
    if (counts.staff > 0) set.add("staff");
    return set;
  }, [counts]);

  const [current, setCurrent] = useState<StepId>(() => {
    for (const step of STEPS) {
      if (!initialCompleted.has(step.id)) return step.id;
    }
    return "done";
  });
  const [completed, setCompleted] = useState<Set<StepId>>(initialCompleted);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function markDone(id: StepId, next?: StepId) {
    setCompleted((prev) => {
      const copy = new Set(prev);
      copy.add(id);
      return copy;
    });
    if (next) setCurrent(next);
    router.refresh();
  }

  function downloadCsvTemplate() {
    const csv = `${KNOWN_HEADERS.join(",")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lodgeSlug}-members-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Lodge onboarding
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Get {lodgeName} live in 15 minutes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            We will guide you through importing members, generating dues,
            scheduling your first summons, and inviting your officers. Each step
            uses the same APIs as the rest of the admin and can be re-run any
            time.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-slate-500 underline-offset-4 hover:underline"
        >
          Skip wizard
        </Link>
      </div>

      <Stepper current={current} completed={completed} />

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {current === "intro" && (
          <IntroStep
            counts={counts}
            onContinue={() => setCurrent("members")}
          />
        )}
        {current === "members" && (
          <MembersStep
            existingCount={counts.members}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onCsvTemplate={downloadCsvTemplate}
            onDone={() => markDone("members", "dues")}
            onSkip={() => setCurrent("dues")}
          />
        )}
        {current === "dues" && (
          <DuesStep
            existingCount={counts.dues}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onDone={() => markDone("dues", "summons")}
            onSkip={() => setCurrent("summons")}
          />
        )}
        {current === "summons" && (
          <SummonsStep
            existingCount={counts.events}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onDone={() => markDone("summons", "staff")}
            onSkip={() => setCurrent("staff")}
          />
        )}
        {current === "staff" && (
          <StaffStep
            existingCount={counts.staff}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onDone={() => markDone("staff", "done")}
            onSkip={() => setCurrent("done")}
          />
        )}
        {current === "done" && <DoneStep lodgeName={lodgeName} />}
      </div>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === current);
            if (idx > 0) setCurrent(STEPS[idx - 1].id);
          }}
          disabled={current === "intro"}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const idx = STEPS.findIndex((s) => s.id === current);
            if (idx < STEPS.length - 1) setCurrent(STEPS[idx + 1].id);
          }}
          disabled={current === "done"}
        >
          Next <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function IntroStep({
  counts,
  onContinue,
}: {
  counts: Counts;
  onContinue: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  const [seedFeedback, setSeedFeedback] = useState<string | null>(null);

  async function applySample() {
    setBusy("seed");
    try {
      const res = await fetch("/api/admin/sample-data", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not seed sample data.");
      setSeedFeedback(
        `Added ${data.created?.members ?? 0} members, ${data.created?.leads ?? 0} leads, ${data.created?.events ?? 0} meetings, ${data.created?.dues ?? 0} dues records.`
      );
      router.refresh();
    } catch (error) {
      setSeedFeedback(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function clearSample() {
    if (!confirm("Remove sample data and archive sample members?")) return;
    setBusy("clear");
    try {
      const res = await fetch("/api/admin/sample-data", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not clear sample data.");
      setSeedFeedback(
        `Removed ${data.removed?.members ?? 0} sample members, ${data.removed?.leads ?? 0} leads, ${data.removed?.events ?? 0} meetings.`
      );
      router.refresh();
    } catch (error) {
      setSeedFeedback(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const items = [
    {
      icon: Users,
      label: "Members on roll",
      value: counts.members,
    },
    {
      icon: Wallet,
      label: "Dues records",
      value: counts.dues,
    },
    {
      icon: CalendarPlus,
      label: "Upcoming meetings",
      value: counts.events,
    },
    {
      icon: UserPlus,
      label: "Officers with admin access",
      value: counts.staff,
    },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        Where you are right now
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-slate-400" />
                {item.value > 0 ? (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-100 text-emerald-700"
                  >
                    Ready
                  </Badge>
                ) : (
                  <Badge variant="outline">To do</Badge>
                )}
              </div>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {item.value}
              </p>
              <p className="text-xs text-slate-500">{item.label}</p>
            </div>
          );
        })}
      </div>
      <p className="text-sm text-slate-500">
        Each step is optional and idempotent. You can come back and re-run any
        of these from the relevant section in the sidebar.
      </p>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Want to explore safely first?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Load a small set of sample brethren, leads, dues and a demo meeting
          so you can click around without any real data. Sample records are
          all prefixed &quot;Sample · &quot; and can be cleared in one click.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={applySample} disabled={busy !== null} size="sm">
            {busy === "seed" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Load sample data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearSample}
            disabled={busy !== null}
          >
            {busy === "clear" ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : null}
            Clear sample data
          </Button>
        </div>
        {seedFeedback && (
          <p className="mt-2 text-xs text-slate-600">{seedFeedback}</p>
        )}
      </div>

      <Button onClick={onContinue}>
        Start <ArrowRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}

function MembersStep({
  existingCount,
  busyKey,
  setBusy,
  setFeedback,
  onCsvTemplate,
  onDone,
  onSkip,
}: {
  existingCount: number;
  busyKey: string | null;
  setBusy: (k: string | null) => void;
  setFeedback: (s: string | null) => void;
  onCsvTemplate: () => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [rows, setRows] = useState<ParsedMemberRow[] | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function handleFile(file: File | null) {
    if (!file) return;
    setFilename(file.name);
    setBusy("csv:read");
    try {
      const text = await file.text();
      const existingRes = await fetch("/api/members?fields=email").catch(() => null);
      const existingEmails = new Set<string>();
      if (existingRes && existingRes.ok) {
        const data = await existingRes.json().catch(() => ({}));
        const list: Array<{ email?: string }> = Array.isArray(data?.members)
          ? data.members
          : Array.isArray(data)
            ? data
            : [];
        for (const m of list) {
          if (m.email) existingEmails.add(m.email.toLowerCase());
        }
      }
      const parsed = parseMembersCsv(text, existingEmails);
      setRows(parsed.rows);
      setFeedback(`Parsed ${parsed.rows.length} rows from ${file.name}.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not read file.");
    } finally {
      setBusy(null);
    }
  }

  async function importValid() {
    if (!rows) return;
    const valid = rows.filter((r) => r.errors.length === 0 && !r.isExisting);
    if (valid.length === 0) {
      setFeedback("No valid new rows to import.");
      return;
    }
    setBusy("csv:import");
    let ok = 0;
    let failed = 0;
    for (const row of valid) {
      try {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildImportPayload(row)),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setFeedback(`Imported ${ok} members. ${failed} failed.`);
    setBusy(null);
    if (ok > 0) onDone();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            <FileSpreadsheet className="mr-2 inline h-5 w-5 text-slate-500" />
            Import your roll book
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Upload a CSV of every active brother. We will preview the rows before
            anything is created. Already have {existingCount} members on file.
          </p>
        </div>
        <Button variant="outline" onClick={onCsvTemplate}>
          <Download className="mr-1 h-4 w-4" /> CSV template
        </Button>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <Label htmlFor="onboarding-csv">Members CSV file</Label>
        <Input
          id="onboarding-csv"
          type="file"
          accept=".csv,text/csv"
          className="mt-2"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
          disabled={busyKey === "csv:read"}
        />
        {filename && (
          <p className="mt-1 text-xs text-slate-500">Selected: {filename}</p>
        )}
      </div>

      {rows && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <p className="text-sm text-slate-700">
              {rows.length} rows /{" "}
              <span className="text-emerald-700">
                {rows.filter((r) => r.errors.length === 0 && !r.isExisting).length}{" "}
                new
              </span>{" "}
              ·{" "}
              <span className="text-amber-700">
                {rows.filter((r) => r.isExisting).length} already on roll
              </span>{" "}
              ·{" "}
              <span className="text-rose-700">
                {rows.filter((r) => r.errors.length > 0).length} with errors
              </span>
            </p>
            <Button
              size="sm"
              onClick={importValid}
              disabled={busyKey === "csv:import"}
            >
              {busyKey === "csv:import" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Import valid rows
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto px-4 py-2 text-xs">
            {rows.slice(0, 30).map((r) => (
              <div key={r.rowIndex} className="flex justify-between border-b border-slate-100 py-1">
                <span>
                  {r.full_name || "(no name)"} &middot; {r.email || "(no email)"}
                </span>
                <span
                  className={
                    r.errors.length
                      ? "text-rose-600"
                      : r.isExisting
                        ? "text-amber-600"
                        : "text-emerald-600"
                  }
                >
                  {r.errors.length
                    ? r.errors.join(", ")
                    : r.isExisting
                      ? "exists"
                      : "ready"}
                </span>
              </div>
            ))}
            {rows.length > 30 && (
              <p className="pt-2 text-slate-500">…and {rows.length - 30} more.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function DuesStep({
  existingCount,
  busyKey,
  setBusy,
  setFeedback,
  onDone,
  onSkip,
}: {
  existingCount: number;
  busyKey: string | null;
  setBusy: (k: string | null) => void;
  setFeedback: (s: string | null) => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const thisYear = new Date().getFullYear();
  const [form, setForm] = useState({
    amount: 200,
    period_start: `${thisYear}-09-01`,
    period_end: `${thisYear + 1}-08-31`,
    instalments: 1,
    frequency: "annually" as "monthly" | "quarterly" | "annually",
  });

  async function runBulk() {
    setBusy("dues:bulk");
    try {
      const res = await fetch("/api/dues/bulk-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          period_start: form.period_start,
          period_end: form.period_end,
          instalments: Number(form.instalments),
          frequency: form.frequency,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not run bulk dues.");
      setFeedback(
        `Created ${data.created ?? 0} dues records, skipped ${data.skipped ?? 0} existing.`
      );
      onDone();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Bulk dues failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        <Wallet className="mr-2 inline h-5 w-5 text-slate-500" />
        Generate annual dues
      </h2>
      <p className="text-sm text-slate-500">
        Creates one dues record per active member for the period below. Already
        have {existingCount} dues records on file. Existing records for the same
        period are skipped automatically.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="dues-amount">Amount per member (GBP)</Label>
          <Input
            id="dues-amount"
            type="number"
            min={0}
            step={1}
            value={form.amount}
            onChange={(e) =>
              setForm((f) => ({ ...f, amount: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <Label htmlFor="dues-instalments">Instalments</Label>
          <Input
            id="dues-instalments"
            type="number"
            min={1}
            max={12}
            value={form.instalments}
            onChange={(e) =>
              setForm((f) => ({ ...f, instalments: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <Label htmlFor="dues-start">Period start</Label>
          <Input
            id="dues-start"
            type="date"
            value={form.period_start}
            onChange={(e) =>
              setForm((f) => ({ ...f, period_start: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="dues-end">Period end</Label>
          <Input
            id="dues-end"
            type="date"
            value={form.period_end}
            onChange={(e) =>
              setForm((f) => ({ ...f, period_end: e.target.value }))
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="dues-freq">Instalment frequency</Label>
          <select
            id="dues-freq"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.frequency}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                frequency: e.target.value as typeof form.frequency,
              }))
            }
          >
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annually">Annually</option>
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={runBulk} disabled={busyKey === "dues:bulk"}>
          {busyKey === "dues:bulk" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : null}
          Run bulk dues
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function SummonsStep({
  existingCount,
  busyKey,
  setBusy,
  setFeedback,
  onDone,
  onSkip,
}: {
  existingCount: number;
  busyKey: string | null;
  setBusy: (k: string | null) => void;
  setFeedback: (s: string | null) => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const today = new Date();
  const future = new Date(today);
  future.setMonth(future.getMonth() + 1);
  const defaultDate = future.toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title: "Regular meeting",
    slug: `regular-${defaultDate}`,
    event_date: defaultDate,
    event_time: "18:30",
    location: "Mark Masons' Hall",
    dress_code: "Morning dress",
  });

  async function createMeeting() {
    setBusy("event:create");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          event_type: "lodge_meeting",
          enable_rsvp: true,
          published: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create meeting.");
      setFeedback("First summons scheduled. Brothers can now RSVP.");
      onDone();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create meeting.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        <CalendarPlus className="mr-2 inline h-5 w-5 text-slate-500" />
        Schedule the first summons
      </h2>
      <p className="text-sm text-slate-500">
        Adds your next regular meeting with RSVP enabled. Already have{" "}
        {existingCount} upcoming meetings.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="evt-title">Title</Label>
          <Input
            id="evt-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div>
          <Label htmlFor="evt-date">Date</Label>
          <Input
            id="evt-date"
            type="date"
            value={form.event_date}
            onChange={(e) => {
              const v = e.target.value;
              setForm((f) => ({ ...f, event_date: v, slug: `regular-${v}` }));
            }}
          />
        </div>
        <div>
          <Label htmlFor="evt-time">Time</Label>
          <Input
            id="evt-time"
            type="time"
            value={form.event_time}
            onChange={(e) => setForm((f) => ({ ...f, event_time: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="evt-loc">Location</Label>
          <Input
            id="evt-loc"
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="evt-dress">Dress code</Label>
          <Input
            id="evt-dress"
            value={form.dress_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, dress_code: e.target.value }))
            }
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={createMeeting} disabled={busyKey === "event:create"}>
          {busyKey === "event:create" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : null}
          Schedule meeting
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

const STAFF_ROLES = [
  { value: "secretary", label: "Secretary" },
  { value: "treasurer", label: "Treasurer" },
  { value: "almoner", label: "Almoner" },
  { value: "charity_steward", label: "Charity Steward" },
  { value: "membership_officer", label: "Membership Officer" },
] as const;

function StaffStep({
  existingCount,
  busyKey,
  setBusy,
  setFeedback,
  onDone,
  onSkip,
}: {
  existingCount: number;
  busyKey: string | null;
  setBusy: (k: string | null) => void;
  setFeedback: (s: string | null) => void;
  onDone: () => void;
  onSkip: () => void;
}) {
  const [invites, setInvites] = useState<
    Array<{ full_name: string; email: string; role: (typeof STAFF_ROLES)[number]["value"] }>
  >([
    { full_name: "", email: "", role: "secretary" },
    { full_name: "", email: "", role: "treasurer" },
  ]);
  const [sent, setSent] = useState(0);

  function update(idx: number, patch: Partial<(typeof invites)[number]>) {
    setInvites((prev) =>
      prev.map((inv, i) => (i === idx ? { ...inv, ...patch } : inv))
    );
  }

  function addRow() {
    setInvites((prev) => [
      ...prev,
      { full_name: "", email: "", role: "almoner" },
    ]);
  }

  function removeRow(idx: number) {
    setInvites((prev) => prev.filter((_, i) => i !== idx));
  }

  async function sendInvites() {
    const valid = invites.filter((i) => i.email && i.full_name);
    if (valid.length === 0) {
      setFeedback("Add at least one officer first.");
      return;
    }
    setBusy("staff:invite");
    let ok = 0;
    let failed = 0;
    for (const inv of valid) {
      try {
        const res = await fetch("/api/admin/staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...inv, active: true }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setSent(ok);
    setFeedback(`Sent ${ok} invites. ${failed} failed.`);
    setBusy(null);
    if (ok > 0) onDone();
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        <UserPlus className="mr-2 inline h-5 w-5 text-slate-500" />
        Invite officers
      </h2>
      <p className="text-sm text-slate-500">
        Send branded Resend invites to your secretary, treasurer, almoner, and
        charity steward so they can take over their part of the platform.
        Already have {existingCount} officers with admin access.
      </p>
      <div className="space-y-2">
        {invites.map((inv, idx) => (
          <div
            key={idx}
            className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_1fr_180px_auto]"
          >
            <Input
              placeholder="Full name"
              value={inv.full_name}
              onChange={(e) => update(idx, { full_name: e.target.value })}
            />
            <Input
              type="email"
              placeholder="email@example.com"
              value={inv.email}
              onChange={(e) => update(idx, { email: e.target.value })}
            />
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              value={inv.role}
              onChange={(e) =>
                update(idx, {
                  role: e.target.value as (typeof STAFF_ROLES)[number]["value"],
                })
              }
            >
              {STAFF_ROLES.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeRow(idx)}
              disabled={invites.length <= 1}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addRow}>
          <UserPlus className="mr-1 h-4 w-4" /> Add another officer
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={sendInvites} disabled={busyKey === "staff:invite"}>
          {busyKey === "staff:invite" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-1 h-4 w-4" />
          )}
          Send invites
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
      {sent > 0 && (
        <p className="text-xs text-emerald-700">
          {sent} invite{sent === 1 ? "" : "s"} sent through Resend.
        </p>
      )}
    </div>
  );
}

function DoneStep({ lodgeName }: { lodgeName: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">
        {lodgeName} is live
      </h2>
      <p className="mx-auto max-w-md text-sm text-slate-500">
        Members are imported, dues are scheduled, your first summons is on the
        calendar, and your officers have been invited. From here, the daily
        flow lives in the sidebar.
      </p>
      <div className="flex justify-center gap-2 pt-2">
        <Link href="/admin">
          <Button>Open dashboard</Button>
        </Link>
        <Link href="/admin/integrations">
          <Button variant="outline">Connect integrations</Button>
        </Link>
      </div>
    </div>
  );
}

