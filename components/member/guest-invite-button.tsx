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
  const [payer, setPayer] = useState<"guest" | "inviter">("guest");
  const [sendEmail, setSendEmail] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setPayer("guest");
    setSendEmail(true);
    setGenerated(null);
    setEmailSent(null);
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
    setEmailSent(null);
    try {
      const trimmedEmail = email.trim();
      const res = await fetch(
        `/api/member/events/${eventId}/guest-invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipient_name: name.trim() || null,
            recipient_email: trimmedEmail || null,
            payer,
            send_email: sendEmail && trimmedEmail.length > 0,
          }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not generate guest link.");
      }
      setGenerated(data.url ?? null);
      setEmailSent(typeof data.email_sent === "boolean" ? data.email_sent : null);
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
                  Generate a private link to invite a member or newcomer to
                  {" "}
                  <span className="font-medium text-slate-700">{eventTitle}</span>.
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
                  {emailSent
                    ? "Your guest link has been emailed to the recipient."
                    : "Your guest link is ready. Share it however you like."}
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
                    placeholder="member@example.com"
                  />
                </div>
                <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Who pays?
                  </legend>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="payer"
                      value="guest"
                      checked={payer === "guest"}
                      onChange={() => setPayer("guest")}
                      className="mt-1 h-3.5 w-3.5"
                    />
                    <span>
                      <span className="font-medium">Guest pays</span>
                      <span className="block text-xs text-slate-500">
                        Your guest will be charged for their dining and service fees.
                      </span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="payer"
                      value="inviter"
                      checked={payer === "inviter"}
                      onChange={() => setPayer("inviter")}
                      className="mt-1 h-3.5 w-3.5"
                    />
                    <span>
                      <span className="font-medium">I&apos;ll cover them</span>
                      <span className="block text-xs text-slate-500">
                        Add their name + dining choice to your own RSVP party
                        when you book; they only pay any optional charity at
                        their link.
                      </span>
                    </span>
                  </label>
                </fieldset>
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={sendEmail}
                    onChange={(event) => setSendEmail(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300"
                  />
                  <span>
                    Email the invite to the guest automatically (requires the
                    email above).
                  </span>
                </label>
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
