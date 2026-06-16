"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightCircle,
  FileText,
  Calendar,
  Mail,
  Phone,
  CheckSquare,
  UserPlus,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";

type ActivityType = "note" | "service" | "phone_call" | "email" | "task";

function dispatchSetType(type: ActivityType) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("newcomer-activity:set-type", { detail: { type } })
  );
}

export function NewcomerDetailActions({
  newcomerId,
  currentStage,
  stageLabels,
  stages,
  email,
  phone,
  fullName,
  alreadyConverted,
  convertedMemberId,
}: {
  newcomerId: string;
  currentStage: string;
  stageLabels: Record<string, string>;
  stages: string[];
  email: string;
  phone: string | null;
  fullName: string;
  alreadyConverted: boolean;
  convertedMemberId: string | null;
}) {
  const router = useRouter();
  const [newStage, setNewStage] = useState("");
  const [changing, setChanging] = useState(false);
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [confirmConvertOpen, setConfirmConvertOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/newcomers/mosque/${newcomerId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not delete newcomer.");
      }
      router.push("/admin/newcomers");
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete newcomer.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleStageChange() {
    if (!newStage || newStage === currentStage) return;
    setChanging(true);
    setStageError(null);
    try {
      const res = await fetch(`/api/newcomers/mosque/${newcomerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not change stage.");
      }
      router.refresh();
    } catch (error) {
      setStageError(error instanceof Error ? error.message : "Could not change stage.");
    } finally {
      setChanging(false);
    }
  }

  async function handleConvert() {
    if (alreadyConverted) return;
    setConvertError(null);
    setConverting(true);
    try {
      const res = await fetch(`/api/newcomers/mosque/${newcomerId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.member?.id) {
        router.push(`/admin/members/${body.member.id}`);
        return;
      }
      if (!res.ok) {
        throw new Error(body.error ?? "Failed to convert newcomer.");
      }
      if (body.member?.id) {
        router.push(`/admin/members/${body.member.id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : "Failed to convert newcomer.");
    } finally {
      setConverting(false);
    }
  }

  const mailHref = `mailto:${email}?subject=${encodeURIComponent(
    "Following up on your enquiry"
  )}&body=${encodeURIComponent(`Dear ${fullName},\n\n`)}`;
  const telHref = phone ? `tel:${phone.replace(/\s+/g, "")}` : null;

  return (
    <div className="admin-surface space-y-5 p-5">
      <h3 className="text-sm font-semibold text-dash-text">Quick Actions</h3>

      {alreadyConverted && convertedMemberId ? (
        <a
          href={`/admin/members/${convertedMemberId}`}
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
        >
          <span className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Member created
          </span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : (
        <Button
          variant="primary"
          className="w-full"
          onClick={() => setConfirmConvertOpen(true)}
          disabled={converting}
        >
          {converting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Converting...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Convert to member
            </span>
          )}
        </Button>
      )}
      {convertError && (
        <p className="text-xs text-red-600">{convertError}</p>
      )}

      <div className="space-y-3">
        <label className="text-xs text-dash-muted">Change stage</label>
        <div className="flex gap-2">
          <Select value={newStage} onValueChange={setNewStage}>
            <SelectTrigger className="flex-1 border-dash-border bg-dash-surface-subtle text-dash-text text-xs">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {stages
                .filter((s) => s !== currentStage)
                .map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabels[s] ?? s}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!newStage || changing}
            onClick={handleStageChange}
            className="shrink-0"
          >
            <ArrowRightCircle className="h-4 w-4" />
          </Button>
        </div>
        {stageError && <p className="text-xs text-red-600">{stageError}</p>}
      </div>

      <div className="space-y-1.5">
        <button
          onClick={() => dispatchSetType("note")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
        >
          <FileText className="h-4 w-4 text-dash-muted" />
          Add note
        </button>
        <button
          onClick={() => dispatchSetType("service")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
        >
          <Calendar className="h-4 w-4 text-dash-muted" />
          Log service
        </button>
        <button
          onClick={() => dispatchSetType("task")}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
        >
          <CheckSquare className="h-4 w-4 text-dash-muted" />
          Add task
        </button>
        <a
          href={mailHref}
          onClick={() => dispatchSetType("email")}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
        >
          <span className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-dash-muted" />
            Send email
          </span>
          <ExternalLink className="h-3 w-3 text-dash-faint" />
        </a>
        {telHref ? (
          <a
            href={telHref}
            onClick={() => dispatchSetType("phone_call")}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
          >
            <span className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-dash-muted" />
              Call & log
            </span>
            <ExternalLink className="h-3 w-3 text-dash-faint" />
          </a>
        ) : (
          <button
            onClick={() => dispatchSetType("phone_call")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
          >
            <Phone className="h-4 w-4 text-dash-muted" />
            Log call
          </button>
        )}
      </div>
      <div className="border-t border-dash-border pt-4">
        <button
          type="button"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={deleting}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Delete newcomer
        </button>
        {deleteError && (
          <p className="mt-1 px-3 text-xs text-red-600">{deleteError}</p>
        )}
      </div>

      <ConfirmActionDialog
        open={confirmConvertOpen}
        onOpenChange={setConfirmConvertOpen}
        title="Convert newcomer to member?"
        description={`This will create an active member record for ${fullName} using the newcomer contact details.`}
        confirmLabel="Convert to member"
        tone="success"
        loading={converting}
        onConfirm={async () => {
          await handleConvert();
          setConfirmConvertOpen(false);
        }}
      />
      <ConfirmActionDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete this newcomer?"
        description={`This permanently removes ${fullName} and any timeline activity from the newcomer pipeline. This cannot be undone.`}
        confirmLabel="Delete newcomer"
        tone="danger"
        loading={deleting}
        onConfirm={async () => {
          await handleDelete();
          setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
}
