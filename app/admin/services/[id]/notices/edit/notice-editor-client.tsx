"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Plus,
  Save,
  Send,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NoticeRecipientsPanel } from "@/components/admin/notice-recipients-panel";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type NoticeForm = {
  issue_date: string;
  opening_text: string;
  agenda_items: string[];
  menu_items: string[];
  dining_time: string;
  notices: string[];
  include_member_directory: boolean;
  newcomer_contacts: NewcomerOfficer[];
  next_service_date: string;
  next_service_note: string;
  service_lead_name: string;
  service_lead_role: string;
};

type NewcomerOfficer = {
  name: string;
  email: string;
  phone: string;
};

type NoticeSend = {
  id: string;
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
};

type NoticeStatus = "none" | "draft" | "approved" | "sent";

function normaliseItems(items: string[]) {
  return items.length > 0 ? items : [""];
}

function normaliseNewcomerOfficers(officers: NewcomerOfficer[]) {
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

export function NoticeEditorClient({
  eventId,
  eventTitle,
  eventType,
  sendHistory,
  initial,
  noticeStatus: initialStatus,
  approvedAt: initialApprovedAt,
  approvedByEmail: initialApprovedBy,
}: {
  eventId: string;
  eventTitle: string;
  eventType: string;
  sendHistory: NoticeSend[];
  initial: NoticeForm;
  noticeStatus: NoticeStatus;
  approvedAt: string | null;
  approvedByEmail: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [status, setStatus] = useState<NoticeStatus>(initialStatus);
  const [approvedAt, setApprovedAt] = useState<string | null>(initialApprovedAt);
  const [approvedBy, setApprovedBy] = useState<string | null>(initialApprovedBy);
  const [drafting, setDrafting] = useState(false);
  const [aiNotes, setAiNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [latestSend, setLatestSend] = useState<NoticeSend | null>(
    sendHistory[0] ?? null
  );
  const newcomerContacts = normaliseNewcomerOfficers(form.newcomer_contacts);

  async function saveNotice() {
    const res = await fetch(`/api/notice/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to save notice");
    }
    return data;
  }

  async function draftWithAi() {
    setDrafting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ai/notice-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, notes: aiNotes }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Could not draft notice.");
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
        draftError instanceof Error ? draftError.message : "Could not draft notice."
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
      await saveNotice();
      if (status !== "sent") {
        setStatus("draft");
        setApprovedAt(null);
        setApprovedBy(null);
      }
      setSaved(true);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save notice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    setApproving(true);
    setError(null);
    setSaved(false);
    try {
      await saveNotice();
      const res = await fetch(`/api/notice/${eventId}/approve`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to approve notice");
      }
      setStatus(data.event?.notice_status ?? "approved");
      setApprovedAt(data.event?.notice_approved_at ?? new Date().toISOString());
      setApprovedBy(data.event?.notice_approved_by_email ?? null);
      router.refresh();
      return true;
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Could not approve notice."
      );
      return false;
    } finally {
      setApproving(false);
    }
  }

  async function handleUnapprove() {
    setApproving(true);
    setError(null);
    try {
      const res = await fetch(`/api/notice/${eventId}/approve`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to revert approval.");
      }
      setStatus(data.event?.notice_status ?? "draft");
      setApprovedAt(null);
      setApprovedBy(null);
      router.refresh();
    } catch (revertError) {
      setError(
        revertError instanceof Error
          ? revertError.message
          : "Could not revert approval."
      );
    } finally {
      setApproving(false);
    }
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/notice/${eventId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to send notice");
      }
      setLatestSend(data.send);
      setStatus("sent");
      router.refresh();
      return true;
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send notice.");
      return false;
    } finally {
      setSending(false);
    }
  }

  const sendDisabled =
    saving || sending || approving || (status !== "approved" && status !== "sent");

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/services">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to services
          </Link>
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="dashboard">
            <Link href={`/admin/services/${eventId}/notice`}>
              <Eye className="mr-2 h-4 w-4" />
              Preview notice
            </Link>
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save notice"}
          </Button>
          {status === "approved" || status === "sent" ? (
            <Button
              type="button"
              variant="dashboard"
              disabled={approving || sending}
              onClick={handleUnapprove}
            >
              <ShieldOff className="mr-2 h-4 w-4" />
              {approving ? "Reverting..." : "Revert approval"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="dashboard"
              disabled={approving || sending}
              onClick={() => setApproveConfirmOpen(true)}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {approving ? "Approving..." : "Approve for sending"}
            </Button>
          )}
          <Button
            type="button"
            variant="default"
            disabled={sendDisabled}
            onClick={() => setSendConfirmOpen(true)}
            title={
              sendDisabled && status !== "sent"
                ? "Approve the notice first to enable sending."
                : undefined
            }
          >
            <Send className="mr-2 h-4 w-4" />
            {sending ? "Sending..." : "Send notice"}
          </Button>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          status === "sent"
            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
            : status === "approved"
              ? "border-blue-200 bg-blue-50 text-blue-900"
              : status === "draft"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-slate-50 text-slate-800"
        }`}
      >
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" />
          {status === "sent"
            ? "Sent. The notice has been emailed to active members."
            : status === "approved"
              ? "Approved and ready to send. Edits will revert this back to draft."
              : status === "draft"
                ? "Draft. Approve before the Send button will work."
                : "Not drafted yet. Save the form first to create a draft."}
        </p>
        {status === "approved" && approvedAt && (
          <p className="mt-1 text-xs">
            Approved {new Date(approvedAt).toLocaleString("en-GB")}
            {approvedBy ? ` by ${approvedBy}` : ""}.
          </p>
        )}
      </div>

      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Notice Editor</h1>
          <p className="admin-page-copy">
            {eventTitle}. The formal opening is generated from the service venue,
            date, time, and mosque details, and can be edited before sending.
          </p>
        </div>
      </div>

      <section className="admin-surface space-y-4 border-amber-200 bg-amber-50/60 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-dash-text">
              <Wand2 className="h-5 w-5 text-amber-600" />
              AI notice draft
            </h2>
            <p className="mt-1 text-sm text-dash-muted">
              Draft the opening, mosque business, and notices into this editable notice
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
            placeholder="Add ceremony details, newcomer officers, dining notes, apologies deadline, or anything the Secretary wants reflected."
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
          Notice saved.
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

      <NoticeRecipientsPanel eventId={eventId} />

      <ConfirmActionDialog
        open={approveConfirmOpen}
        onOpenChange={setApproveConfirmOpen}
        title="Approve notice for sending?"
        description="This saves the current draft and marks it as approved. Sending is still a separate, deliberate step. Any further edits will revert the approval."
        confirmLabel="Approve"
        loading={approving}
        onConfirm={async () => {
          const ok = await handleApprove();
          if (ok) setApproveConfirmOpen(false);
        }}
      />

      <ConfirmActionDialog
        open={sendConfirmOpen}
        onOpenChange={setSendConfirmOpen}
        title="Send notice to active members?"
        description="Creates secure access links and emails every active member for this mosque. The send is recorded in the audit trail. Drafts cannot be sent until they have been approved."
        confirmLabel="Send notice"
        loading={sending}
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
              Formal notice wording
            </label>
            <Textarea
              id="opening-text"
              value={form.opening_text}
              rows={7}
              placeholder="By Command of the Lead Imam..."
              onChange={(event) =>
                setForm((current) => ({ ...current, opening_text: event.target.value }))
              }
            />
            <p className="text-xs leading-5 text-dash-muted">
              This wording is stored with this event&apos;s notice, so you can adjust it
              for a specific service without changing the mosque defaults.
            </p>
          </div>
        </div>
      </section>

      <section className="admin-surface space-y-6 p-6">
        <EditableList
          label="Mosque business"
          items={form.agenda_items}
          setItems={(items) => setForm((current) => ({ ...current, agenda_items: items }))}
          placeholder="To open the Mosque."
        />
      </section>

      {eventType === "special_service" && (
        <section className="admin-surface space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">Service lead</h2>
            <p className="mt-1 text-sm text-dash-muted">
              Used to enrich agenda item 3 for this special_service service.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-dash-muted"
                htmlFor="master-elect-name"
              >
                Service lead name
              </label>
              <Input
                id="master-elect-name"
                value={form.service_lead_name}
                placeholder="W Bro Firstname Lastname"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service_lead_name: event.target.value,
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
                value={form.service_lead_role}
                rows={3}
                placeholder="Qualified to serve by virtue of holding the office of WM of Example Mosque 1234 in the year 2024-25."
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    service_lead_role: event.target.value,
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
            Newcomer contact and next service
          </h2>
          <p className="mt-1 text-sm text-dash-muted">
            Printed at the foot of the notice. The next service date is also
            included in the notice email.
          </p>
        </div>
        <div className="space-y-4">
          {newcomerContacts.map((officer, index) => (
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
                    const next = [...newcomerContacts];
                    next[index] = { ...next[index], name: event.target.value };
                    setForm((current) => ({ ...current, newcomer_contacts: next }));
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
                    const next = [...newcomerContacts];
                    next[index] = { ...next[index], email: event.target.value };
                    setForm((current) => ({ ...current, newcomer_contacts: next }));
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
                      const next = [...newcomerContacts];
                      next[index] = { ...next[index], phone: event.target.value };
                      setForm((current) => ({ ...current, newcomer_contacts: next }));
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove Newcomer contact"
                    onClick={() => {
                      const next = newcomerContacts.filter(
                        (_, officerIndex) => officerIndex !== index
                      );
                      setForm((current) => ({
                        ...current,
                        newcomer_contacts: normaliseNewcomerOfficers(next),
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
                newcomer_contacts: [
                  ...newcomerContacts,
                  { name: "", email: "", phone: "" },
                ],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Newcomer contact
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-dash-muted"
              htmlFor="next-service-date"
            >
              Next service date
            </label>
            <Input
              id="next-service-date"
              type="date"
              value={form.next_service_date}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_service_date: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-dash-muted"
              htmlFor="next-service-note"
            >
              Next service note (optional)
            </label>
            <Input
              id="next-service-note"
              value={form.next_service_note}
              placeholder="Special service"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  next_service_note: event.target.value,
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
