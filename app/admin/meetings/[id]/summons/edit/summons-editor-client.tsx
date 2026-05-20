"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, Eye, Loader2, Plus, Save, Send, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type SummonsForm = {
  issue_date: string;
  opening_text: string;
  agenda_items: string[];
  menu_items: string[];
  dining_time: string;
  notices: string[];
  include_member_directory: boolean;
  visiting_officers: VisitingOfficer[];
  next_meeting_date: string;
  next_meeting_note: string;
  master_elect_name: string;
  master_elect_qualification: string;
};

type VisitingOfficer = {
  name: string;
  email: string;
  phone: string;
};

type SummonsSend = {
  id: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

function normaliseItems(items: string[]) {
  return items.length > 0 ? items : [""];
}

function normaliseVisitingOfficers(officers: VisitingOfficer[]) {
  return officers.length > 0 ? officers : [{ name: "", email: "", phone: "" }];
}

function EditableList({
  label,
  items,
  setItems,
  placeholder,
}: {
  label: string;
  items: string[];
  setItems: (items: string[]) => void;
  placeholder: string;
}) {
  const safeItems = normaliseItems(items);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold text-dash-text">{label}</label>
        <Button
          type="button"
          variant="dashboard"
          size="sm"
          onClick={() => setItems([...safeItems, ""])}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {safeItems.map((item, index) => (
          <div key={index} className="flex gap-2">
            <Textarea
              value={item}
              rows={2}
              placeholder={placeholder}
              onChange={(event) => {
                const next = [...safeItems];
                next[index] = event.target.value;
                setItems(next);
              }}
              className="min-h-[4.5rem] border-dash-border bg-dash-surface"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${label.toLowerCase()} item`}
              onClick={() => {
                const next = safeItems.filter((_, itemIndex) => itemIndex !== index);
                setItems(next.length > 0 ? next : [""]);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummonsEditorClient({
  eventId,
  eventTitle,
  eventType,
  sendHistory,
  initial,
}: {
  eventId: string;
  eventTitle: string;
  eventType: string;
  sendHistory: SummonsSend[];
  initial: SummonsForm;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [latestSend, setLatestSend] = useState<SummonsSend | null>(
    sendHistory[0] ?? null
  );
  const visitingOfficers = normaliseVisitingOfficers(form.visiting_officers);

  async function saveSummons() {
    const res = await fetch(`/api/summons/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to save summons");
    }
    return data;
  }

  async function draftWithAi() {
    setDrafting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/summons-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, notes: aiNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not draft summons.");
      }
      const draft = data.draft;
      setForm((current) => ({
        ...current,
        opening_text: draft.opening_text ?? current.opening_text,
        agenda_items: Array.isArray(draft.agenda_items)
          ? draft.agenda_items
          : current.agenda_items,
        notices: Array.isArray(draft.notices) ? draft.notices : current.notices,
      }));
      setSaved(false);
    } catch (draftError) {
      setError(
        draftError instanceof Error ? draftError.message : "Could not draft summons."
      );
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await saveSummons();
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save summons.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setSaved(false);
    try {
      await saveSummons();
      const res = await fetch(`/api/summons/${eventId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send summons");
      }
      setLatestSend(data.send);
      router.refresh();
      return true;
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send summons.");
      return false;
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/meetings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to meetings
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="dashboard">
            <Link href={`/admin/meetings/${eventId}/summons`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview summons
            </Link>
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save summons"}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={saving || sending}
            onClick={() => setSendConfirmOpen(true)}
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send summons"}
          </Button>
        </div>
      </div>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Summons Editor</h1>
          <p className="admin-page-copy">
            {eventTitle}. The formal opening is generated from the meeting venue,
            date, time, and lodge details, and can be edited before sending.
          </p>
        </div>
      </div>

      <section className="admin-surface space-y-4 border-amber-200 bg-amber-50/60 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-dash-text">
              <Wand2 className="h-5 w-5 text-amber-600" />
              AI summons draft
            </h2>
            <p className="mt-1 text-sm text-dash-muted">
              Draft the opening, lodge business, and notices into this editable summons
              form. Nothing sends until you save and confirm send.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            onClick={draftWithAi}
            disabled={drafting || saving || sending}
          >
            {drafting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="mr-2 h-4 w-4" />
            )}
            Draft with AI
          </Button>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-dash-muted" htmlFor="ai-notes">
            Notes for AI
          </label>
          <Textarea
            id="ai-notes"
            rows={3}
            value={aiNotes}
            onChange={(event) => setAiNotes(event.target.value)}
            placeholder="Add ceremony details, visiting officers, dining notes, apologies deadline, or anything the Secretary wants reflected."
          />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Summons saved.
        </div>
      )}
      {latestSend && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          Last sent {new Date(latestSend.created_at).toLocaleString("en-GB")} to{" "}
          {latestSend.sent_count} of {latestSend.recipient_count} active members.
          {latestSend.failed_count > 0
            ? ` ${latestSend.failed_count} failed.`
            : " No failures recorded."}
        </div>
      )}

      <ConfirmActionDialog
        open={sendConfirmOpen}
        onOpenChange={setSendConfirmOpen}
        title="Send summons to active members?"
        description="This saves the current summons, creates secure access links, and emails every active member for this lodge. The send is recorded in the audit trail."
        confirmLabel="Send summons"
        loading={sending || saving}
        onConfirm={async () => {
          const sent = await handleSend();
          if (sent) setSendConfirmOpen(false);
        }}
      />

      <section className="admin-surface space-y-5 p-6">
        <h2 className="text-lg font-semibold text-dash-text">Formal opening</h2>
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-dash-muted" htmlFor="issue-date">
              Issue date
            </label>
            <Input
              id="issue-date"
              type="date"
              value={form.issue_date}
              onChange={(event) =>
                setForm((current) => ({ ...current, issue_date: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-dash-muted" htmlFor="opening-text">
              Formal summons wording
            </label>
            <Textarea
              id="opening-text"
              value={form.opening_text}
              rows={7}
              placeholder="By Command of the Worshipful Master..."
              onChange={(event) =>
                setForm((current) => ({ ...current, opening_text: event.target.value }))
              }
            />
            <p className="text-xs leading-5 text-dash-muted">
              This wording is stored with this event&apos;s summons, so you can adjust it
              for a specific meeting without changing the lodge defaults.
            </p>
          </div>
        </div>
      </section>

      <section className="admin-surface space-y-6 p-6">
        <EditableList
          label="Lodge business"
          items={form.agenda_items}
          setItems={(items) => setForm((current) => ({ ...current, agenda_items: items }))}
          placeholder="To open the Lodge."
        />
      </section>

      {eventType === "installation" && (
        <section className="admin-surface space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">Master Elect</h2>
            <p className="mt-1 text-sm text-dash-muted">
              Used to enrich agenda item 3 for this installation meeting.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-dash-muted"
                htmlFor="master-elect-name"
              >
                Master Elect name
              </label>
              <Input
                id="master-elect-name"
                value={form.master_elect_name}
                placeholder="W Bro Firstname Lastname"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    master_elect_name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-dash-muted"
                htmlFor="master-elect-qualification"
              >
                Qualification line
              </label>
              <Textarea
                id="master-elect-qualification"
                value={form.master_elect_qualification}
                rows={3}
                placeholder="Qualified to serve by virtue of holding the office of WM of Example Lodge 1234 in the year 2024-25."
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    master_elect_qualification: event.target.value,
                  }))
                }
              />
            </div>
          </div>
        </section>
      )}

      <section className="admin-surface space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-dash-muted" htmlFor="dining-time">
              Dining time
            </label>
            <Input
              id="dining-time"
              value={form.dining_time}
              placeholder="7.30 pm"
              onChange={(event) =>
                setForm((current) => ({ ...current, dining_time: event.target.value }))
              }
            />
          </div>
          <EditableList
            label="Menu"
            items={form.menu_items}
            setItems={(items) => setForm((current) => ({ ...current, menu_items: items }))}
            placeholder="Menu item"
          />
        </div>
      </section>

      <section className="admin-surface space-y-6 p-6">
        <EditableList
          label="Member notices"
          items={form.notices}
          setItems={(items) => setForm((current) => ({ ...current, notices: items }))}
          placeholder="Notice text"
        />
      </section>

      <section className="admin-surface space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold text-dash-text">
            Visiting Officer and next meeting
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            Printed at the foot of the summons. The next meeting date is also
            included in the summons email.
          </p>
        </div>
        <div className="space-y-4">
          {visitingOfficers.map((officer, index) => (
            <div
              key={index}
              className="grid gap-4 rounded-xl border border-dash-border bg-dash-surface-subtle p-4 md:grid-cols-3"
            >
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-dash-muted"
                  htmlFor={`vo-name-${index}`}
                >
                  VO name
                </label>
                <Input
                  id={`vo-name-${index}`}
                  value={officer.name}
                  placeholder="W Bro Firstname Lastname"
                  onChange={(event) => {
                    const next = [...visitingOfficers];
                    next[index] = { ...next[index], name: event.target.value };
                    setForm((current) => ({ ...current, visiting_officers: next }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-dash-muted"
                  htmlFor={`vo-email-${index}`}
                >
                  VO email
                </label>
                <Input
                  id={`vo-email-${index}`}
                  type="email"
                  value={officer.email}
                  placeholder="vo@example.com"
                  onChange={(event) => {
                    const next = [...visitingOfficers];
                    next[index] = { ...next[index], email: event.target.value };
                    setForm((current) => ({ ...current, visiting_officers: next }));
                  }}
                />
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-dash-muted"
                  htmlFor={`vo-phone-${index}`}
                >
                  VO phone (optional)
                </label>
                <div className="flex gap-2">
                  <Input
                    id={`vo-phone-${index}`}
                    value={officer.phone}
                    placeholder="07XXX XXX XXX"
                    onChange={(event) => {
                      const next = [...visitingOfficers];
                      next[index] = { ...next[index], phone: event.target.value };
                      setForm((current) => ({ ...current, visiting_officers: next }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove Visiting Officer"
                    onClick={() => {
                      const next = visitingOfficers.filter(
                        (_, officerIndex) => officerIndex !== index
                      );
                      setForm((current) => ({
                        ...current,
                        visiting_officers: normaliseVisitingOfficers(next),
                      }));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="dashboard"
            size="sm"
            onClick={() =>
              setForm((current) => ({
                ...current,
                visiting_officers: [
                  ...visitingOfficers,
                  { name: "", email: "", phone: "" },
                ],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Visiting Officer
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-dash-muted"
              htmlFor="next-meeting-date"
            >
              Next meeting date
            </label>
            <Input
              id="next-meeting-date"
              type="date"
              value={form.next_meeting_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_meeting_date: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-dash-muted"
              htmlFor="next-meeting-note"
            >
              Next meeting note (optional)
            </label>
            <Input
              id="next-meeting-note"
              value={form.next_meeting_note}
              placeholder="Installation"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_meeting_note: event.target.value,
                }))
              }
            />
          </div>
        </div>
      </section>

      <section className="admin-surface p-6">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={form.include_member_directory}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                include_member_directory: event.target.checked,
              }))
            }
            className="mt-1 h-4 w-4 rounded border-input text-blue-600 focus:ring-blue-500"
          />
          <span>
            <span className="block text-sm font-semibold text-dash-text">
              Include member directory
            </span>
            <span className="mt-1 block text-sm text-dash-muted">
              Includes active member address, phone, RA/C markers, and honorary section
              from member records.
            </span>
          </span>
        </label>
      </section>
    </form>
  );
}
