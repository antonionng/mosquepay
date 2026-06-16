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
  giving: number;
  events: number;
  staff: number;
};

type StepId = "intro" | "members" | "giving" | "notice" | "staff" | "done";

const STEPS: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "intro",
    title: "Welcome",
    description: "A 15 minute setup to get your mosque live.",
  },
  {
    id: "members",
    title: "Import members",
    description: "Upload a CSV of your roll book.",
  },
  {
    id: "giving",
    title: "Annual giving",
    description: "Generate this year's giving for every active member.",
  },
  {
    id: "notice",
    title: "First notice",
    description: "Schedule your next regular service.",
  },
  {
    id: "staff",
    title: "Officer access",
    description: "Invite your secretary, treasurer, and pastoral_care.",
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
  mosqueSlug,
  mosqueName,
  counts,
}: {
  mosqueSlug: string;
  mosqueName: string;
  counts: Counts;
}) {
  const router = useRouter();
  const initialCompleted = useMemo(() => {
    const set = new Set<StepId>(["intro"]);
    if (counts.members > 0) set.add("members");
    if (counts.giving > 0) set.add("giving");
    if (counts.events > 0) set.add("notice");
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
    link.download = `${mosqueSlug}-members-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Mosque onboarding
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Get {mosqueName} live in 15 minutes
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            We will guide you through importing members, generating giving,
            scheduling your first notice, and inviting your officers. Each step
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
            onDone={() => markDone("members", "giving")}
            onSkip={() => setCurrent("giving")}
          />
        )}
        {current === "giving" && (
          <GivingStep
            existingCount={counts.giving}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onDone={() => markDone("giving", "notice")}
            onSkip={() => setCurrent("notice")}
          />
        )}
        {current === "notice" && (
          <NoticeStep
            existingCount={counts.events}
            busyKey={busy}
            setBusy={setBusy}
            setFeedback={setFeedback}
            onDone={() => markDone("notice", "staff")}
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
        {current === "done" && <DoneStep mosqueName={mosqueName} />}
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
        `Added ${data.created?.members ?? 0} members, ${data.created?.newcomers ?? 0} newcomers, ${data.created?.events ?? 0} services, ${data.created?.giving ?? 0} giving records.`
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
        `Removed ${data.removed?.members ?? 0} sample members, ${data.removed?.newcomers ?? 0} newcomers, ${data.removed?.events ?? 0} services.`
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
      label: "Giving records",
      value: counts.giving,
    },
    {
      icon: CalendarPlus,
      label: "Upcoming services",
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
          Load a small set of sample members, newcomers, giving and a demo service
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
            Upload a CSV of every active member. We will preview the rows before
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

function GivingStep({
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
    setBusy("giving:bulk");
    try {
      const res = await fetch("/api/giving/bulk-run", {
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
      if (!res.ok) throw new Error(data.error ?? "Could not run bulk giving.");
      setFeedback(
        `Created ${data.created ?? 0} giving records, skipped ${data.skipped ?? 0} existing.`
      );
      onDone();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Bulk giving failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        <Wallet className="mr-2 inline h-5 w-5 text-slate-500" />
        Generate annual giving
      </h2>
      <p className="text-sm text-slate-500">
        Creates one giving record per active member for the period below. Already
        have {existingCount} giving records on file. Existing records for the same
        period are skipped automatically.
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="giving-amount">Amount per member (GBP)</Label>
          <Input
            id="giving-amount"
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
          <Label htmlFor="giving-instalments">Instalments</Label>
          <Input
            id="giving-instalments"
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
          <Label htmlFor="giving-start">Period start</Label>
          <Input
            id="giving-start"
            type="date"
            value={form.period_start}
            onChange={(e) =>
              setForm((f) => ({ ...f, period_start: e.target.value }))
            }
          />
        </div>
        <div>
          <Label htmlFor="giving-end">Period end</Label>
          <Input
            id="giving-end"
            type="date"
            value={form.period_end}
            onChange={(e) =>
              setForm((f) => ({ ...f, period_end: e.target.value }))
            }
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="giving-freq">Instalment frequency</Label>
          <select
            id="giving-freq"
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
        <Button onClick={runBulk} disabled={busyKey === "giving:bulk"}>
          {busyKey === "giving:bulk" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : null}
          Run bulk giving
        </Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function NoticeStep({
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
    title: "Regular service",
    slug: `regular-${defaultDate}`,
    event_date: defaultDate,
    event_time: "18:30",
    location: "Mark members' Hall",
    dress_code: "Morning dress",
  });

  async function createService() {
    setBusy("event:create");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          event_type: "mosque_service",
          enable_rsvp: true,
          published: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not create service.");
      setFeedback("First notice scheduled. Members can now RSVP.");
      onDone();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not create service.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        <CalendarPlus className="mr-2 inline h-5 w-5 text-slate-500" />
        Schedule the first notice
      </h2>
      <p className="text-sm text-slate-500">
        Adds your next regular service with RSVP enabled. Already have{" "}
        {existingCount} upcoming services.
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
        <Button onClick={createService} disabled={busyKey === "event:create"}>
          {busyKey === "event:create" ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : null}
          Schedule service
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
  { value: "pastoral_care", label: "PastoralCare" },
  { value: "charity_steward", label: "Charity Steward" },
  { value: "membership_officer", label: "Membership Officer" },
  { value: "master", label: "Master" },
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
      { full_name: "", email: "", role: "pastoral_care" },
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
        Send branded Resend invites to your secretary, treasurer, pastoral_care, and
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

function DoneStep({ mosqueName }: { mosqueName: string }) {
  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-7 w-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">
        {mosqueName} is live
      </h2>
      <p className="mx-auto max-w-md text-sm text-slate-500">
        Members are imported, giving are scheduled, your first notice is on the
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

