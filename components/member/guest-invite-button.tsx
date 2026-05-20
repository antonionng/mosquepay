"use client";

import { useState } from "react";
import { Copy, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  eventId: string;
  eventTitle: string;
  size?: "sm" | "default";
  variant?: "primary" | "secondary" | "outline" | "ghost";
};

export function MemberGuestInviteButton({
  eventId,
  eventTitle,
  size = "sm",
  variant = "secondary",
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setGenerated(null);
    setError(null);
  }

  function close() {
    reset();
    setOpen(false);
  }

  async function generate() {
    setError(null);
    setSubmitting(true);
    setGenerated(null);
    try {
      const res = await fetch(
        `/api/member/events/${eventId}/guest-invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_name: name.trim() || null,
            recipient_email: email.trim() || null,
            payer: "guest",
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not generate guest link.");
      }
      setGenerated(data.url ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copy() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        Invite a guest
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-950">
                  Invite a guest
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Generate a private link to invite a brother or visitor to
                  {" "}
                  <span className="font-medium text-slate-700">{eventTitle}</span>.
                  They will pay their own dining and meeting fees.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {generated ? (
              <div className="mt-5 space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-medium text-blue-900">
                  Your guest link is ready. Share it however you like.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-blue-900">
                    {generated}
                  </code>
                  <Button type="button" size="sm" variant="primary" onClick={copy}>
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Copy
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={reset}
                >
                  Generate another link
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guest-name">Guest name (optional)</Label>
                  <Input
                    id="guest-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. W. Bro John Smith"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guest-email">Guest email (optional)</Label>
                  <Input
                    id="guest-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="brother@example.com"
                  />
                </div>
                {error ? (
                  <p className="text-sm text-destructive">{error}</p>
                ) : null}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={close}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={generate}
                    disabled={submitting}
                  >
                    {submitting ? "Generating..." : "Generate link"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
