"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  ExternalLink,
  ListChecks,
  Loader2,
  Mail,
  ScrollText,
  Send,
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

type CommunicationCategory =
  | "members_newsletter"
  | "post_meeting_recap"
  | "event_reminder"
  | "candidate_follow_up"
  | "dues_reminder"
  | "welfare_check_in"
  | "charity_appeal";

type CommunicationAudience = "active_members" | "all_members" | "leads";

type CommunicationDraft = {
  subject: string;
  html_body: string;
  recommended_audience: CommunicationAudience;
  admin_notes: string[];
};

type SelectedRecipient = {
  email: string;
  name: string;
};

const COMMUNICATION_CATEGORIES: Array<{
  value: CommunicationCategory;
  label: string;
}> = [
  { value: "members_newsletter", label: "Members newsletter" },
  { value: "post_meeting_recap", label: "Post-meeting recap" },
  { value: "event_reminder", label: "Event reminder" },
  { value: "candidate_follow_up", label: "Candidate follow-up" },
  { value: "dues_reminder", label: "Dues reminder" },
  { value: "welfare_check_in", label: "Welfare check-in" },
  { value: "charity_appeal", label: "Charity appeal" },
];

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
  const [summonsFeedback, setSummonsFeedback] = useState<string | null>(null);
  const [summaryEvent, setSummaryEvent] = useState(events[0]?.id ?? "");
  const [summaryNotes, setSummaryNotes] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summons");
  const [communicationCategory, setCommunicationCategory] =
    useState<CommunicationCategory>("members_newsletter");
  const [communicationEvent, setCommunicationEvent] = useState(events[0]?.id ?? "");
  const [communicationNotes, setCommunicationNotes] = useState("");
  const [communicationDraft, setCommunicationDraft] =
    useState<CommunicationDraft | null>(null);
  const [communicationAudience, setCommunicationAudience] =
    useState<CommunicationAudience>("active_members");
  const [communicationRecipient, setCommunicationRecipient] =
    useState<SelectedRecipient | null>(null);
  const [communicationFeedback, setCommunicationFeedback] = useState<string | null>(null);
  const [communicationAudienceCount, setCommunicationAudienceCount] =
    useState<number | null>(null);
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
    setSummonsFeedback(null);
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

  async function applySummonsDraft() {
    if (!summonsEvent || !summonsDraft) return;
    setBusy("summons-apply");
    setSummonsFeedback(null);
    try {
      const existingRes = await fetch(`/api/summons/${summonsEvent}`);
      const existingData = await existingRes.json().catch(() => ({}));
      if (!existingRes.ok) {
        throw new Error(existingData.error ?? "Could not load current summons.");
      }
      const current = existingData.summons ?? {};
      const saveRes = await fetch(`/api/summons/${summonsEvent}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...current,
          opening_text: summonsDraft.opening_text,
          agenda_items: summonsDraft.agenda_items,
          notices: summonsDraft.notices,
        }),
      });
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok) {
        throw new Error(saveData.error ?? "Could not save summons draft.");
      }
      setSummonsFeedback(
        "Draft applied to the summons. Review it in the editor, send a test, then send to members."
      );
    } catch (error) {
      setSummonsFeedback(
        error instanceof Error ? error.message : "Could not apply summons draft."
      );
    } finally {
      setBusy(null);
    }
  }

  function escapeHtml(value: string) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function applySummaryToCommunication() {
    if (!summary) return;
    const event = events.find((item) => item.id === summaryEvent);
    setCommunicationCategory("post_meeting_recap");
    setCommunicationEvent(summaryEvent);
    setCommunicationAudience("active_members");
    setCommunicationDraft({
      subject: event ? `Thank you for attending ${event.title}` : "Post-meeting update",
      html_body: [
        "<p>Dear {{first_name}},</p>",
        ...summary
          .split(/\n+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
      ].join("\n"),
      recommended_audience: "active_members",
      admin_notes: [
        "Review the recap before sending.",
        "Preview the audience count in Communications.",
        "Use the Communications send button to record it in history.",
      ],
    });
    setCommunicationRecipient(null);
    setCommunicationFeedback("Post-meeting recap is ready to preview and send.");
    setActiveTab("communications");
  }

  function draftRiskCommunication(row: RiskRow) {
    setCommunicationCategory("welfare_check_in");
    setCommunicationAudience("active_members");
    setCommunicationRecipient({ email: row.email, name: row.full_name });
    setCommunicationNotes(
      `Draft a careful follow-up for ${row.full_name}. Reasons flagged: ${row.reasons.join(", ")}. Keep it sensitive and suitable for secretary or Almoner review.`
    );
    setCommunicationDraft({
      subject: `A note from the lodge`,
      html_body: [
        "<p>Dear {{first_name}},</p>",
        "<p>I hope you are keeping well. We wanted to check in and let you know the lodge is thinking of you.</p>",
        "<p>If there is anything practical the lodge can do, or if you would simply welcome a conversation, please do let us know.</p>",
        "<p>Yours fraternally,<br/>The Almoner</p>",
      ].join("\n"),
      recommended_audience: "active_members",
      admin_notes: [
        `Started from the member-at-risk row for ${row.full_name}.`,
        "This should be reviewed and sent with care.",
        "This will target only the selected member unless you clear the recipient.",
      ],
    });
    setCommunicationFeedback(
      "Welfare draft created for the selected member. Review carefully before sending."
    );
    setActiveTab("communications");
  }

  async function draftCommunication() {
    setBusy("communication-draft");
    setCommunicationFeedback(null);
    setCommunicationAudienceCount(null);
    try {
      const res = await fetch("/api/ai/communications-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: communicationCategory,
          event_id: communicationEvent,
          notes: communicationNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not draft communication.");
      setCommunicationDraft(data.draft);
      setCommunicationAudience(data.draft.recommended_audience);
      setCommunicationRecipient(null);
      setCommunicationFeedback(
        data.source === "ai"
          ? "AI draft ready for review."
          : "Fallback draft ready for review."
      );
    } catch (error) {
      setCommunicationFeedback(
        error instanceof Error ? error.message : "Could not draft communication."
      );
    } finally {
      setBusy(null);
    }
  }

  async function previewCommunicationAudience() {
    if (!communicationDraft) return;
    setBusy("communication-preview");
    setCommunicationFeedback(null);
    try {
      const res = await fetch("/api/communications/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: null,
          subject: communicationDraft.subject,
          html_body: communicationDraft.html_body,
          audience: communicationAudience,
          recipient_email: communicationRecipient?.email,
          recipient_name: communicationRecipient?.name,
          dry_run: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not preview audience.");
      setCommunicationAudienceCount(Number(data.audience_count ?? 0));
      setCommunicationFeedback(`Ready to send to ${data.audience_count ?? 0} recipients.`);
    } catch (error) {
      setCommunicationFeedback(
        error instanceof Error ? error.message : "Could not preview audience."
      );
    } finally {
      setBusy(null);
    }
  }

  async function sendCommunication() {
    if (!communicationDraft) return;
    setBusy("communication-send");
    setCommunicationFeedback(null);
    try {
      const res = await fetch("/api/communications/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: null,
          subject: communicationDraft.subject,
          html_body: communicationDraft.html_body,
          audience: communicationAudience,
          recipient_email: communicationRecipient?.email,
          recipient_name: communicationRecipient?.name,
          dry_run: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      setCommunicationFeedback(
        `Sent ${data.sent ?? 0}. Failed ${data.failed ?? 0}. Skipped ${data.skipped ?? 0}.`
      );
    } catch (error) {
      setCommunicationFeedback(error instanceof Error ? error.message : "Send failed.");
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="summons">Summons draft</TabsTrigger>
          <TabsTrigger value="communications">Comms handoff</TabsTrigger>
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
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button onClick={draftSummons} disabled={busy === "summons"}>
                {busy === "summons" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Draft summons
              </Button>
              <Button
                variant="outline"
                onClick={applySummonsDraft}
                disabled={!summonsDraft || busy === "summons-apply"}
              >
                {busy === "summons-apply" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Apply to summons
              </Button>
            </div>
            {summonsFeedback && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
                {summonsFeedback}
              </div>
            )}
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
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={applySummonsDraft}
                    disabled={busy === "summons-apply"}
                  >
                    Apply to summons editor
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/admin/meetings/${summonsEvent}/summons/edit`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open editor
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/admin/meetings/${summonsEvent}/summons`}>
                      Preview summons
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="communications">
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Draft for Communications
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use AI for the first pass, then send through the same
                  Communications history and delivery pipeline.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="w-fit">
                  <Mail className="mr-1 h-3 w-3" /> Uses Communications
                </Badge>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/communications">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Communications
                  </Link>
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <Field label="Category">
                <select
                  value={communicationCategory}
                  onChange={(e) =>
                    setCommunicationCategory(e.target.value as CommunicationCategory)
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  {COMMUNICATION_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Related meeting or event">
                <select
                  value={communicationEvent}
                  onChange={(e) => setCommunicationEvent(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="">No event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title} ({new Date(e.event_date).toLocaleDateString("en-GB")})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Audience">
                <select
                  value={communicationAudience}
                  onChange={(e) =>
                    setCommunicationAudience(e.target.value as CommunicationAudience)
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="active_members">Active members</option>
                  <option value="all_members">All members</option>
                  <option value="leads">Leads</option>
                </select>
              </Field>
            </div>
            {communicationRecipient && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
                <span>
                  Targeted recipient: {communicationRecipient.name} (
                  {communicationRecipient.email})
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCommunicationRecipient(null)}
                >
                  Clear and use audience
                </Button>
              </div>
            )}
            <Field label="Notes for AI">
              <textarea
                rows={3}
                value={communicationNotes}
                onChange={(e) => setCommunicationNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Add the key points, tone, deadline, or call to action."
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={draftCommunication}
                disabled={busy === "communication-draft"}
              >
                {busy === "communication-draft" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 h-4 w-4" />
                )}
                Draft communication
              </Button>
              <Button
                variant="outline"
                onClick={previewCommunicationAudience}
                disabled={!communicationDraft || busy === "communication-preview"}
              >
                {busy === "communication-preview" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ListChecks className="mr-2 h-4 w-4" />
                )}
                Preview audience
              </Button>
              <Button
                variant="outline"
                onClick={sendCommunication}
                disabled={!communicationDraft || busy === "communication-send"}
              >
                {busy === "communication-send" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send through Communications
              </Button>
            </div>
            {communicationFeedback && (
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
                {communicationFeedback}
              </div>
            )}
            {communicationAudienceCount !== null && (
              <p className="mt-2 text-xs text-slate-500">
                Current audience count: {communicationAudienceCount}
              </p>
            )}
            {communicationDraft && (
              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
                <Field label="Subject">
                  <input
                    value={communicationDraft.subject}
                    onChange={(e) =>
                      setCommunicationDraft((draft) =>
                        draft ? { ...draft, subject: e.target.value } : draft
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Body HTML">
                  <textarea
                    rows={10}
                    value={communicationDraft.html_body}
                    onChange={(e) =>
                      setCommunicationDraft((draft) =>
                        draft ? { ...draft, html_body: e.target.value } : draft
                      )
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </Field>
                {communicationDraft.admin_notes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Admin review notes
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
                      {communicationDraft.admin_notes.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}
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
              <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-800">
                <div className="whitespace-pre-line">{summary}</div>
                <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                  <Button variant="outline" size="sm" onClick={applySummaryToCommunication}>
                    <Mail className="mr-2 h-4 w-4" />
                    Turn into sendable email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCommunicationCategory("members_newsletter");
                      setCommunicationNotes(summary);
                      setActiveTab("communications");
                    }}
                  >
                    Use in newsletter
                  </Button>
                </div>
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
                    <TableHead className="text-right">Next action</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => draftRiskCommunication(row)}
                          >
                            Draft check-in
                          </Button>
                          <Button asChild variant="ghost" size="sm">
                            <a href={`/admin/members/${row.member_id}`}>
                              Open
                            </a>
                          </Button>
                        </div>
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
                    <TableHead className="text-right">Next action</TableHead>
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
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <a href={`/admin/members/${row.member_id}`}>
                            Fix record
                          </a>
                        </Button>
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
