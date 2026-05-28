"use client";

// Member-portal Gift Aid onboarding.
//
// Three surfaces, one component family:
//   1. <GiftAidOnboarding/>  -- the orchestrator. Polls /api/member/gift-aid
//      on mount, decides whether to render the first-time modal, the
//      persistent dismissible banner, or nothing.
//   2. <GiftAidDeclarationDialog/> -- the form itself. Captures name,
//      address, eligibility tick, posts to /api/member/gift-aid.
//   3. <GiftAidBanner/> -- thin reminder bar shown beneath the top nav
//      once the modal has been dismissed.
//
// Decision tree (intentionally cheap to reason about):
//   - declaration exists & active            -> nothing
//   - consent_status === "declined"          -> nothing
//   - !prompted                              -> modal (first time only)
//   - prompted but no declaration            -> banner
//
// We intentionally NEVER show this on signup-adjacent routes -- the layout
// wrapper already gates this with `isAuth`, so by the time we mount the
// member is in the portal proper.

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  Heart,
  ShieldCheck,
  X,
} from "lucide-react";

type StatusResponse = {
  declaration: {
    id: string;
    donor_name: string;
    donor_address_line_1: string | null;
    donor_address_line_2: string | null;
    donor_city: string | null;
    donor_postcode: string | null;
    evidence_source: "digital" | "paper" | "verbal" | "import_legacy";
    paper_received_date: string | null;
    created_at: string;
    revoked_at: string | null;
  } | null;
  consent_status: "unknown" | "declared" | "declined";
  prompted: boolean;
};

type ProfileSeed = {
  full_name: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  postcode?: string | null;
};

export function GiftAidOnboarding({ profile }: { profile?: ProfileSeed }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/member/gift-aid", { cache: "no-store" });
      if (!res.ok) {
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
      if (
        !data.declaration &&
        data.consent_status !== "declined" &&
        !data.prompted
      ) {
        setOpen(true);
      }
    } catch {
      /* swallow; banner will not show */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function dismiss() {
    setOpen(false);
    try {
      await fetch("/api/member/gift-aid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
    } catch {
      /* non-fatal */
    } finally {
      setStatus((s) => (s ? { ...s, prompted: true } : s));
    }
  }

  async function decline() {
    setOpen(false);
    try {
      await fetch("/api/member/gift-aid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });
    } catch {
      /* non-fatal */
    } finally {
      setStatus((s) =>
        s ? { ...s, prompted: true, consent_status: "declined" } : s
      );
    }
  }

  if (!loaded || !status) return null;

  const showBanner =
    !open &&
    !status.declaration &&
    status.consent_status !== "declined" &&
    status.prompted;

  return (
    <>
      <GiftAidDeclarationDialog
        open={open}
        onOpenChange={(v) => {
          // Treat a passive close (esc, backdrop) as "dismiss", not "decline".
          if (!v) {
            dismiss();
          } else {
            setOpen(true);
          }
        }}
        profile={profile}
        onDeclined={decline}
        onSubmitted={() => {
          setOpen(false);
          refresh();
        }}
      />
      {showBanner ? (
        <GiftAidBanner
          onOpen={() => setOpen(true)}
          onDecline={decline}
        />
      ) : null}
    </>
  );
}

export function GiftAidBanner({
  onOpen,
  onDecline,
}: {
  onOpen: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Heart className="h-4 w-4 text-emerald-700" />
        </div>
        <div>
          <p className="font-semibold text-emerald-900">
            Boost your donations by 25 percent with Gift Aid
          </p>
          <p className="mt-0.5 text-emerald-800">
            One short form. Then every donation you make to the lodge is
            Gift Aided automatically.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDecline}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100"
          aria-label="Not eligible for Gift Aid"
        >
          Not eligible
        </button>
        <Button size="sm" variant="primary" onClick={onOpen}>
          Set up Gift Aid
        </Button>
      </div>
    </div>
  );
}

export function GiftAidDeclarationDialog({
  open,
  onOpenChange,
  profile,
  onSubmitted,
  onDeclined,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: ProfileSeed;
  onSubmitted: () => void;
  onDeclined?: () => void;
}) {
  const [donorName, setDonorName] = useState(profile?.full_name ?? "");
  const [line1, setLine1] = useState(profile?.address_line_1 ?? "");
  const [line2, setLine2] = useState(profile?.address_line_2 ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [postcode, setPostcode] = useState(profile?.postcode ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDonorName((v) => v || profile?.full_name || "");
      setLine1((v) => v || profile?.address_line_1 || "");
      setLine2((v) => v || profile?.address_line_2 || "");
      setCity((v) => v || profile?.city || "");
      setPostcode((v) => v || profile?.postcode || "");
    }
  }, [open, profile]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!confirmed) {
      setError("Please confirm you are a UK taxpayer.");
      return;
    }
    if (!donorName.trim() || !line1.trim() || !city.trim() || !postcode.trim()) {
      setError("Name, address line 1, town/city, and postcode are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/member/gift-aid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: true,
          donor_name: donorName.trim(),
          donor_address_line_1: line1.trim(),
          donor_address_line_2: line2.trim() || null,
          donor_city: city.trim(),
          donor_postcode: postcode.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not record declaration.");
      }
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="success">
              <ShieldCheck className="mr-1 h-3 w-3" />
              HMRC ready
            </Badge>
          </div>
          <DialogTitle>Set up Gift Aid</DialogTitle>
          <DialogDescription>
            If you are a UK taxpayer, the lodge can reclaim 25p for every £1
            you give. This declaration covers past, present, and future
            donations until you choose to revoke it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="ga-name">Full name</Label>
            <Input
              id="ga-name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-line1">Address line 1</Label>
              <Input
                id="ga-line1"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                autoComplete="address-line1"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ga-line2">Address line 2 (optional)</Label>
              <Input
                id="ga-line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                autoComplete="address-line2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-city">Town / city</Label>
              <Input
                id="ga-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                autoComplete="address-level2"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ga-postcode">Postcode</Label>
              <Input
                id="ga-postcode"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                autoComplete="postal-code"
                autoCapitalize="characters"
              />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            I want to Gift Aid this donation and any donations I make in the
            future or have made in the past 4 years to the named charity. I
            am a UK taxpayer and understand that if I pay less Income Tax
            and/or Capital Gains Tax than the amount of Gift Aid claimed on
            all my donations in that tax year it is my responsibility to
            pay any difference.
          </div>
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-input text-blue-600"
            />
            <span>
              I confirm I am a UK taxpayer and want to Gift Aid my
              donations.
            </span>
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onDeclined ? (
              <button
                type="button"
                onClick={onDeclined}
                className="rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
              >
                I&apos;m not eligible
              </button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={submitting || !confirmed}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4" />
                  Confirm Gift Aid declaration
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compact summary panel for the profile page. */
export function GiftAidStatusPanel() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/member/gift-aid", { cache: "no-store" });
      if (res.ok) setStatus((await res.json()) as StatusResponse);
    } catch {
      /* swallow */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function revoke() {
    if (!confirm("Revoke your Gift Aid declaration? You can set up a new one later.")) {
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const res = await fetch("/api/member/gift-aid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? "Could not revoke.");
      }
      setMessage(
        body.pending
          ? "Revocation requested. Your treasurer will confirm once they pull the paper file."
          : "Declaration revoked."
      );
      refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {message}
        </div>
      ) : null}
      {status?.declaration && !status.declaration.revoked_at ? (
        <div className="flex items-start gap-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="font-medium text-emerald-900">
              Gift Aid is active
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Your donations are boosted by 25 percent. Declaration on file
              since {new Date(status.declaration.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              {status.declaration.evidence_source === "paper"
                ? " (paper, on file with the Charity Steward)."
                : " (digital)."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                Update address
              </Button>
              <button
                type="button"
                onClick={revoke}
                disabled={working}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
              >
                Revoke declaration
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <FileCheck className="mt-0.5 h-5 w-5 text-slate-400" />
          <div className="flex-1">
            <p className="font-medium text-slate-700">
              Gift Aid not declared
            </p>
            <p className="mt-1 text-sm text-slate-500">
              If you are a UK taxpayer, you can boost your donations by 25
              percent at no extra cost to you.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="mt-3"
              onClick={() => setOpen(true)}
            >
              Set up Gift Aid
            </Button>
          </div>
        </div>
      )}
      <GiftAidDeclarationDialog
        open={open}
        onOpenChange={setOpen}
        profile={{
          full_name: status?.declaration?.donor_name ?? null,
          address_line_1: status?.declaration?.donor_address_line_1 ?? null,
          address_line_2: status?.declaration?.donor_address_line_2 ?? null,
          city: status?.declaration?.donor_city ?? null,
          postcode: status?.declaration?.donor_postcode ?? null,
        }}
        onSubmitted={() => {
          setOpen(false);
          refresh();
        }}
      />
    </div>
  );
}

// Tiny no-op so eslint doesn't flag unused imports we left for future use.
void X;
