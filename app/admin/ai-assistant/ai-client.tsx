"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  ScrollText,
  Sparkles,
  UserMinus,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type EventLite = { id: string; title: string; event_date: string };

type SummonsDraft = {
  opening_text: string;
  agenda_items: string[];
  notices: string[];
};

type RiskRow = {
  member_id: string;
  full_name: string;
  email: string;
  reasons: string[];
  score: number;
};

type DataIssue = {
  member_id: string;
  full_name: string;
  fields: string[];
};

export function AiAssistantClient({
  hasApiKey,
  events,
}: {
  hasApiKey: boolean;
  events: EventLite[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [summonsEvent, setSummonsEvent] = useState(events[0]?.id ?? "");
  const [summonsNotes, setSummonsNotes] = useState("");
  const [summonsDraft, setSummonsDraft] = useState<SummonsDraft | null>(null);
  const [summaryEvent, setSummaryEvent] = useState(events[0]?.id ?? "");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [risk, setRisk] = useState<RiskRow[] | null>(null);
  const [issues, setIssues] = useState<DataIssue[] | null>(null);

  useEffect(() => {
    void loadRisk();
    void loadIssues();
  }, []);

  async function loadRisk() {
    const res = await fetch("/api/ai/members-at-risk");
    if (res.ok) {
      const data = await res.json();
      setRisk(data.rows);
    }
  }

  async function loadIssues() {
    const res = await fetch("/api/ai/data-quality");
    if (res.ok) {
      const data = await res.json();
      setIssues(data.issues);
    }
  }

  async function draftSummons() {
    if (!summonsEvent) return;
    setBusy("summons");
    try {
      const res = await fetch("/api/ai/summons-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: summonsEvent, notes: summonsNotes }),
      });
      const data = await res.json();
      setSummonsDraft(data.draft);
    } finally {
      setBusy(null);
    }
  }

  async function draftSummary() {
    if (!summaryEvent) return;
    setBusy("summary");
    try {
      const res = await fetch("/api/ai/post-meeting-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: summaryEvent, notes: summaryNotes }),
      });
      const data = await res.json();
      setSummary(data.summary);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI operations assistant</h1>
        <p className="mt-1 text-sm text-slate-500">
          Draft summonses and post-meeting recaps, surface members at risk, and
          spot data quality issues. Add an OpenAI API key to enable AI drafting;
          deterministic fallbacks are always available.
        </p>
        <div className="mt-2">
          {hasApiKey ? (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              <Sparkles className="mr-1 h-3 w-3" /> AI drafting enabled
            </Badge>
          ) : (
            <Badge variant="outline" className="border-amber-300 text-amber-700">
              <AlertTriangle className="mr-1 h-3 w-3" /> Add OPENAI_API_KEY to
              enable AI drafting
            </Badge>
          )}
        </div>
      </div>

      <Tabs defaultValue="summons">
        <TabsList>
          <TabsTrigger value="summons">Summons draft</TabsTrigger>
          <TabsTrigger value="summary">Post-meeting</TabsTrigger>
          <TabsTrigger value="risk">Members at risk</TabsTrigger>
          <TabsTrigger value="quality">Data quality</TabsTrigger>
        </TabsList>

        <TabsContent value="summons">
          <Card>
            <h2 className="text-base font-semibold text-slate-900">
              Auto-draft summons
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Meeting">
                <select
                  value={summonsEvent}
                  onChange={(e) => setSummonsEvent(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({new Date(e.event_date).toLocaleDateString("en-GB")})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Optional secretary notes">
                <input
                  value={summonsNotes}
                  onChange={(e) => setSummonsNotes(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3 text-right">
              <Button onClick={draftSummons} disabled={busy === "summons"}>
                {busy === "summons" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Draft summons
              </Button>
            </div>
            {summonsDraft && (
              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-500">Opening</p>
                  <p className="mt-1 whitespace-pre-line text-slate-800">
                    {summonsDraft.opening_text}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Agenda</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-slate-800">
                    {summonsDraft.agenda_items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">Notices</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-800">
                    {summonsDraft.notices.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <Card>
            <h2 className="text-base font-semibold text-slate-900">
              Post-meeting summary
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Meeting">
                <select
                  value={summaryEvent}
                  onChange={(e) => setSummaryEvent(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({new Date(e.event_date).toLocaleDateString("en-GB")})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Optional notes from the meeting">
                <input
                  value={summaryNotes}
                  onChange={(e) => setSummaryNotes(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
            </div>
            <div className="mt-3 text-right">
              <Button onClick={draftSummary} disabled={busy === "summary"}>
                {busy === "summary" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ScrollText className="mr-2 h-4 w-4" />
                )}
                Draft summary
              </Button>
            </div>
            {summary && (
              <div className="mt-4 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
                {summary}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="risk">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Members at risk
              </h2>
              <Button variant="outline" size="sm" onClick={loadRisk}>
                Refresh
              </Button>
            </div>
            {!risk ? (
              <Loader2 className="mt-4 h-4 w-4 animate-spin text-slate-400" />
            ) : risk.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                <UserMinus className="mr-1 inline h-4 w-4" /> No members flagged.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Reasons</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {risk.map((row) => (
                    <TableRow key={row.member_id}>
                      <TableCell className="text-sm">
                        <p className="font-medium text-slate-900">
                          {row.full_name}
                        </p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <ul className="list-disc pl-4">
                          {row.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {row.score}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="quality">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Data quality nudges
              </h2>
              <Button variant="outline" size="sm" onClick={loadIssues}>
                Refresh
              </Button>
            </div>
            {!issues ? (
              <Loader2 className="mt-4 h-4 w-4 animate-spin text-slate-400" />
            ) : issues.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                <ClipboardList className="mr-1 inline h-4 w-4" /> Member records
                look clean.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Missing or invalid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map((row) => (
                    <TableRow key={row.member_id}>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {row.full_name}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        {row.fields.join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {children}
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
