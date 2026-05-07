"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Loader2,
  Send,
  Sparkles,
  ListChecks,
  PlayCircle,
  Inbox,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
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
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import { coerceButtonsInEmailHtml } from "@/lib/email/coerce-buttons";
import { TemplateMarketplaceClient } from "../templates/marketplace-client";

type Template = {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  html_body: string;
  is_system: boolean;
  merge_tags: string[];
};

type Message = {
  id: string;
  channel: "email" | "sms";
  template_key: string | null;
  subject: string | null;
  body_preview: string | null;
  recipient_email: string | null;
  recipient_name: string | null;
  audience_label: string | null;
  status: "queued" | "sent" | "failed" | "skipped";
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

type Automation = {
  key: string;
  label: string;
  enabled: boolean;
  last_run_at: string | null;
};

type MarketplaceTemplate = {
  template_key: string;
  name: string;
  category:
    | "newsletter"
    | "summons"
    | "dues"
    | "events"
    | "milestones"
    | "welfare";
  description: string;
  subject: string;
  html_body: string;
  merge_tags: readonly string[];
  installed: boolean;
};

const statusColor: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  sent: "success",
  queued: "warning",
  failed: "destructive",
  skipped: "secondary",
};

export function CommunicationsClient({
  templates,
  messages,
  automations,
  marketplaceTemplates,
  audienceCounts,
}: {
  templates: Template[];
  messages: Message[];
  automations: Automation[];
  marketplaceTemplates: MarketplaceTemplate[];
  audienceCounts: { active_members: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const blank = useMemo(
    () => templates.find((t) => t.template_key === "system.newsletter.blank") ?? templates[0],
    [templates]
  );
  const [draft, setDraft] = useState({
    template_key: blank?.template_key ?? "",
    subject: blank?.subject ?? "",
    html_body: blank?.html_body ?? "",
    audience: "active_members" as "active_members" | "all_members" | "leads",
  });
  const [editor, setEditor] = useState<{
    mode: "create" | "edit";
    id?: string;
    template_key: string;
    name: string;
    subject: string;
    html_body: string;
  } | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  const [pendingNewsletterSend, setPendingNewsletterSend] = useState<{
    audienceCount: number;
    subject: string;
    audience: string;
  } | null>(null);

  function openCreateTemplate() {
    setEditor({
      mode: "create",
      template_key: "custom.",
      name: "",
      subject: "",
      html_body: "<p>Hello {{first_name}},</p><p></p><p>Yours fraternally,<br/>{{lodge_name}}</p>",
    });
  }

  function openEditTemplate(t: Template) {
    setEditor({
      mode: "edit",
      id: t.id,
      template_key: t.template_key,
      name: t.name,
      subject: t.subject,
      html_body: t.html_body,
    });
  }

  async function saveTemplate() {
    if (!editor) return;
    setBusy("save-template");
    setFeedback(null);
    try {
      const res = await fetch("/api/communications/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: editor.template_key.trim(),
          name: editor.name.trim(),
          subject: editor.subject,
          html_body: editor.html_body,
          channel: "email",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save template.");
      setFeedback("Template saved.");
      setEditor(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not save template.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteTemplate(id: string) {
    setBusy(`del-${id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/communications/templates/${id}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not delete template.");
      setFeedback("Template deleted.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not delete template.");
    } finally {
      setBusy(null);
    }
  }

  function selectTemplate(key: string) {
    const t = templates.find((tt) => tt.template_key === key);
    if (!t) return;
    setDraft({
      template_key: t.template_key,
      subject: t.subject,
      html_body: t.html_body,
      audience: draft.audience,
    });
  }

  async function send(dry: boolean) {
    setBusy(dry ? "preview" : "send");
    setFeedback(null);
    try {
      const res = await fetch("/api/communications/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: draft.template_key,
          subject: draft.subject,
          html_body: draft.html_body,
          audience: draft.audience,
          dry_run: dry,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Send failed.");
      if (dry) {
        setFeedback(`Will send to ${body.audience_count} recipients.`);
      } else {
        setFeedback(
          `Sent ${body.sent ?? 0}. Failed ${body.failed ?? 0}. Skipped ${body.skipped ?? 0}.`
        );
        router.refresh();
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Send failed.");
    } finally {
      setBusy(null);
    }
  }

  async function requestNewsletterSend() {
    setBusy("send-preview");
    setFeedback(null);
    try {
      const res = await fetch("/api/communications/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: draft.template_key,
          subject: draft.subject,
          html_body: draft.html_body,
          audience: draft.audience,
          dry_run: true,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not preview audience.");
      setPendingNewsletterSend({
        audienceCount: Number(body.audience_count ?? 0),
        subject: draft.subject || "(no subject)",
        audience: draft.audience.replaceAll("_", " "),
      });
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not preview audience.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleAutomation(key: string, enabled: boolean) {
    setBusy(`toggle:${key}`);
    try {
      const res = await fetch("/api/communications/automations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ automation_key: key, enabled }),
      });
      if (!res.ok) throw new Error("Could not update automation.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function runAutomations() {
    setBusy("run-automations");
    setFeedback(null);
    try {
      const res = await fetch("/api/communications/automations", {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Run failed.");
      const summary = (body.results ?? [])
        .filter((r: { attempted: number }) => r.attempted > 0)
        .map(
          (r: { key: string; sent: number; attempted: number }) =>
            `${r.key}: ${r.sent}/${r.attempted}`
        )
        .join(" · ");
      setFeedback(summary || "Automations ran. Nothing to send today.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Run failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Communications</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send newsletters, manage templates, and toggle automations like
          birthdays and post-meeting thank-yous.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <Tabs defaultValue="newsletter">
        <TabsList>
          <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
        </TabsList>

        <TabsContent value="newsletter">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Template">
                    <select
                      value={draft.template_key}
                      onChange={(e) => selectTemplate(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      {templates.map((t) => (
                        <option key={t.id} value={t.template_key}>
                          {t.name}
                          {t.is_system ? " (system)" : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Audience">
                    <select
                      value={draft.audience}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          audience: e.target.value as
                            | "active_members"
                            | "all_members"
                            | "leads",
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="active_members">
                        Active members ({audienceCounts.active_members})
                      </option>
                      <option value="all_members">All members</option>
                      <option value="leads">Leads</option>
                    </select>
                  </Field>
                </div>
                <Field label="Subject">
                  <input
                    value={draft.subject}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, subject: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Body (HTML)">
                  <textarea
                    rows={12}
                    value={draft.html_body}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, html_body: e.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => send(true)}
                    variant="outline"
                    disabled={busy !== null}
                  >
                    {busy === "preview" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ListChecks className="mr-2 h-4 w-4" />
                    )}
                    Preview audience
                  </Button>
                  <Button onClick={requestNewsletterSend} disabled={busy !== null}>
                    {busy === "send-preview" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send newsletter
                  </Button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Live preview
              </p>
              <div
                className="mt-3 max-h-[420px] overflow-y-auto rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-800"
                dangerouslySetInnerHTML={{
                  __html: coerceButtonsInEmailHtml(draft.html_body),
                }}
              />
              <p className="mt-3 text-[11px] text-slate-400">
                Merge tags are replaced per recipient when sending.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="automations">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={runAutomations}
                disabled={busy !== null}
              >
                {busy === "run-automations" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlayCircle className="mr-2 h-4 w-4" />
                )}
                Run today
              </Button>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Automation</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last run</TableHead>
                    <TableHead className="w-32 text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {automations.map((a) => (
                    <TableRow key={a.key}>
                      <TableCell className="text-sm font-medium text-slate-900">
                        <Sparkles className="mr-2 inline h-3 w-3 text-amber-500" />
                        {a.label}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.enabled ? "success" : "secondary"}>
                          {a.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">
                        {a.last_run_at
                          ? new Date(a.last_run_at).toLocaleString("en-GB")
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy !== null}
                          onClick={() => toggleAutomation(a.key, !a.enabled)}
                        >
                          {a.enabled ? "Disable" : "Enable"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                      <Inbox className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                      No messages yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-500">
                        {new Date(message.sent_at ?? message.created_at).toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium text-slate-900">
                          {message.recipient_name ?? message.recipient_email}
                        </p>
                        <p className="text-xs text-slate-500">
                          {message.recipient_email}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {message.subject}
                        {message.audience_label && (
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {message.audience_label}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor[message.status] ?? "secondary"} className="capitalize">
                          {message.status}
                        </Badge>
                        {message.error_message && (
                          <p className="mt-0.5 text-[11px] text-red-600">
                            {message.error_message}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="templates">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <Mail className="mt-0.5 h-4 w-4 text-blue-500" />
                <div>
                  Templates support merge tags like{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {`{{first_name}}`}
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                    {`{{lodge_name}}`}
                  </code>
                  . System templates can be edited but not deleted.
                </div>
              </div>
              <Button onClick={openCreateTemplate} size="sm">
                <Plus className="mr-2 h-4 w-4" /> New template
              </Button>
            </div>

            {editor && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {editor.mode === "create" ? "New template" : "Edit template"}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditor(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Template key">
                    <input
                      value={editor.template_key}
                      onChange={(e) =>
                        setEditor({ ...editor, template_key: e.target.value })
                      }
                      disabled={editor.mode === "edit"}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 font-mono text-xs disabled:bg-slate-50"
                      placeholder="custom.welcome"
                    />
                  </Field>
                  <Field label="Display name">
                    <input
                      value={editor.name}
                      onChange={(e) =>
                        setEditor({ ...editor, name: e.target.value })
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    />
                  </Field>
                </div>
                <Field label="Subject">
                  <input
                    value={editor.subject}
                    onChange={(e) =>
                      setEditor({ ...editor, subject: e.target.value })
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
                <Field label="Body (HTML)">
                  <textarea
                    rows={10}
                    value={editor.html_body}
                    onChange={(e) =>
                      setEditor({ ...editor, html_body: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
                  />
                </Field>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditor(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={saveTemplate}
                    disabled={
                      busy === "save-template" ||
                      !editor.template_key.trim() ||
                      !editor.name.trim()
                    }
                  >
                    {busy === "save-template" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save template
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Origin</TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {t.name}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-slate-500">
                        {t.template_key}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {t.subject}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_system ? "secondary" : "success"}>
                          {t.is_system ? "System" : "Custom"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditTemplate(t)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!t.is_system && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === `del-${t.id}`}
                              onClick={() => setDeleteTemplateId(t.id)}
                            >
                              {busy === `del-${t.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="library">
          <TemplateMarketplaceClient templates={marketplaceTemplates} />
        </TabsContent>
      </Tabs>
      <ConfirmActionDialog
        open={deleteTemplateId !== null}
        onOpenChange={(open) => !open && setDeleteTemplateId(null)}
        title="Delete template?"
        description="This removes the custom template for this lodge. System templates cannot be deleted."
        confirmLabel="Delete template"
        tone="danger"
        loading={deleteTemplateId ? busy === `del-${deleteTemplateId}` : false}
        onConfirm={async () => {
          if (!deleteTemplateId) return;
          await deleteTemplate(deleteTemplateId);
          setDeleteTemplateId(null);
        }}
      />
      <ConfirmActionDialog
        open={pendingNewsletterSend !== null}
        onOpenChange={(open) => !open && setPendingNewsletterSend(null)}
        title="Send newsletter?"
        description={
          pendingNewsletterSend
            ? `This will send "${pendingNewsletterSend.subject}" to ${pendingNewsletterSend.audienceCount} ${pendingNewsletterSend.audience} recipients.`
            : "This will send the newsletter to the selected audience."
        }
        confirmLabel="Send newsletter"
        tone="danger"
        loading={busy === "send"}
        onConfirm={async () => {
          await send(false);
          setPendingNewsletterSend(null);
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
      <span className="mb-1 mt-3 block">{label}</span>
      {children}
    </label>
  );
}
