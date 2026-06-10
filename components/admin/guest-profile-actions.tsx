"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  KeyRound,
  Pencil,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestFormDialog, type GuestFormValues } from "@/components/admin/guest-form-dialog";
import { GuestInviteToEventDialog } from "@/components/admin/guest-invite-to-event-dialog";

type Props = {
  guestId: string;
  guestName: string;
  guestEmail: string | null;
  visitCount: number;
  archivedAt: string | null;
  hasNewcomerToken: boolean;
  initialValues: Partial<GuestFormValues>;
};

export function GuestProfileActions({
  guestId,
  guestName,
  guestEmail,
  visitCount,
  archivedAt,
  hasNewcomerToken,
  initialValues,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busy, setBusy] = useState<
    null | "archive" | "restore" | "purge" | "revoke_token"
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function archive() {
    if (!confirm("Archive this guest? They will be hidden from the directory.")) {
      return;
    }
    setError(null);
    setBusy("archive");
    try {
      const res = await fetch(`/api/admin/guests/${guestId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not archive guest.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setError(null);
    setBusy("restore");
    try {
      const res = await fetch(
        `/api/admin/guests/${guestId}?action=restore`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not restore guest.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function revokeNewcomerToken() {
    if (
      !confirm(
        "Revoke this guest's private newcomer link? Any bookmarked URL they have will stop working. A new one will be created the next time they self-register or book."
      )
    ) {
      return;
    }
    setError(null);
    setBusy("revoke_token");
    try {
      const res = await fetch(
        `/api/admin/guests/${guestId}/newcomersor-token`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not revoke newcomer link.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function purge() {
    if (
      !confirm(
        `Permanently delete ${guestName}? This cannot be undone, and only works if they have no recorded visits.`
      )
    ) {
      return;
    }
    setError(null);
    setBusy("purge");
    try {
      const res = await fetch(
        `/api/admin/guests/${guestId}?action=purge`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not delete guest.");
      }
      router.push("/admin/guests");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          onClick={() => setInviteOpen(true)}
          disabled={Boolean(archivedAt)}
        >
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Invite to event
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit details
        </Button>
        {archivedAt ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={restore}
            disabled={busy !== null}
          >
            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
            {busy === "restore" ? "Restoring..." : "Restore"}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={archive}
            disabled={busy !== null}
          >
            <Archive className="mr-1.5 h-3.5 w-3.5" />
            {busy === "archive" ? "Archiving..." : "Archive"}
          </Button>
        )}
        {hasNewcomerToken ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={revokeNewcomerToken}
            disabled={busy !== null}
          >
            <KeyRound className="mr-1.5 h-3.5 w-3.5" />
            {busy === "revoke_token" ? "Revoking..." : "Revoke newcomer link"}
          </Button>
        ) : null}
        {visitCount === 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={purge}
            disabled={busy !== null}
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-2 text-sm text-destructive">{error}</p>
      ) : null}

      <GuestFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        guestId={guestId}
        initialValues={initialValues}
      />
      <GuestInviteToEventDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        guestId={guestId}
        guestName={guestName}
        guestEmail={guestEmail}
      />
    </>
  );
}
