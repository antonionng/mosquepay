"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  Banknote,
  CheckCircle2,
  Copy,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  ScanLine,
  Share2,
  ShieldAlert,
  TriangleAlert,
  XCircle,
  Clock,
  History,
  Plus,
  Minus,
  Delete,
  RefreshCw,
  User,
  UserX,
  HeartHandshake,
  Search,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type MemberOption = {
  id: string;
  full_name: string;
  email: string | null;
};

type Props = {
  lodgeSlug: string;
  connected: boolean;
  mooovStatus: string | null;
  members: MemberOption[];
};

type StatusPhase = "pending" | "awaiting_payment" | "succeeded" | "failed";

type StatusResponse = {
  payment_id: string;
  phase: StatusPhase;
  raw_status: string;
  amount_minor: number;
  currency: string;
  failure_reason: string | null;
  projected: {
    id: string;
    total: number;
    refunded_total: number;
    completed_at: string | null;
  } | null;
};

type MintResponse =
  | {
      url: string;
      payment_id: string;
      amount: number;
      currency: string;
    }
  | { error: string; code?: string };

type HistoryDerived =
  | "paid"
  | "open"
  | "expired"
  | "cancelled"
  | "failed";

type HistoryItem = {
  payment_id: string;
  amount_minor: number;
  currency: string;
  raw_status: string;
  derived_status: HistoryDerived;
  failure_reason: string | null;
  created_at: string;
  captured_at: string | null;
  category: string | null;
  reference: string | null;
  description: string | null;
  hosted_url: string | null;
  created_by_email: string | null;
  member_id: string | null;
  member_name: string | null;
  member_email: string | null;
  gift_aid_eligible: boolean;
  gift_aid_declaration_id: string | null;
  paid_by_name: string | null;
  paid_by_email: string | null;
  paid_total: number | null;
  paid_at: string | null;
};

const CATEGORIES = [
  { id: "general", label: "General lodge payment" },
  { id: "charity", label: "Charity collection" },
  { id: "raffle", label: "Raffle" },
  { id: "dining", label: "Dining / festive board" },
  { id: "subscriptions", label: "Subscriptions / dues top-up" },
  { id: "other", label: "Other" },
] as const;

const PRESET_AMOUNTS = [1, 2, 5, 10, 20, 50, 100] as const;

export function TakePaymentClient({
  lodgeSlug,
  connected,
  mooovStatus,
  members,
}: Props) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>(
    "general",
  );
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [memberId, setMemberId] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{
    paymentId: string;
    url: string;
    qrDataUrl: string;
    amountMinor: number;
    currency: string;
    reference: string;
    description: string;
    memberName: string | null;
    giftAidEligible: boolean;
  } | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/take-payment/history?limit=30", {
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { items: HistoryItem[] };
        setHistory(body.items ?? []);
      }
    } catch {
      // Non-fatal; leave the panel as-is.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      void loadHistory();
    }
  }, [connected, loadHistory]);

  // Refresh history whenever an active session reaches a terminal phase, so
  // the panel below shows the just-completed payment without a manual reload.
  useEffect(() => {
    if (status?.phase === "succeeded" || status?.phase === "failed") {
      void loadHistory();
    }
  }, [status?.phase, loadHistory]);

  const reset = useCallback(() => {
    setAmount("");
    setReference("");
    setDescription("");
    setCategory("general");
    setMemberId(null);
    setSession(null);
    setStatus(null);
    setError(null);
  }, []);

  const generateQrForUrl = useCallback(async (url: string) => {
    return QRCode.toDataURL(url, {
      width: 720,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }, []);

  const reopenFromHistory = useCallback(
    async (item: HistoryItem) => {
      if (!item.hosted_url) return;
      try {
        const qrDataUrl = await generateQrForUrl(item.hosted_url);
        setSession({
          paymentId: item.payment_id,
          url: item.hosted_url,
          qrDataUrl,
          amountMinor: item.amount_minor,
          currency: item.currency,
          reference: item.reference ?? "",
          description: item.description ?? "",
          memberName: item.member_name,
          giftAidEligible: item.gift_aid_eligible,
        });
        setStatus(null);
      } catch (err) {
        console.error("re-open qr failed", err);
      }
    },
    [generateQrForUrl],
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      setError(null);
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        setError("Enter an amount in pounds (e.g. 45 or 12.50).");
        return;
      }
      if (numericAmount > 5000) {
        setError("Amounts above £5,000 cannot be taken on the in-person flow.");
        return;
      }
      setMinting(true);
      try {
        const res = await fetch("/api/admin/take-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: numericAmount,
            category,
            reference,
            description,
            member_id: memberId,
          }),
        });
        const body = (await res.json()) as MintResponse;
        if (!res.ok || "error" in body) {
          const message = "error" in body ? body.error : "Could not mint payment.";
          setError(message);
          setMinting(false);
          return;
        }
        const qrDataUrl = await generateQrForUrl(body.url);
        setSession({
          paymentId: body.payment_id,
          url: body.url,
          qrDataUrl,
          amountMinor: body.amount,
          currency: body.currency,
          reference,
          description,
          memberName: selectedMember?.full_name ?? null,
          // We don't echo the server-side GA detection back yet — the
          // history panel below will reflect it once the QR shows up there
          // (a single fast refresh kicks off right after mint).
          giftAidEligible: false,
        });
        void loadHistory();
      } catch (err) {
        console.error("take-payment mint failed", err);
        setError("Network error. Try again.");
      } finally {
        setMinting(false);
      }
    },
    [
      amount,
      category,
      reference,
      description,
      memberId,
      selectedMember,
      generateQrForUrl,
      loadHistory,
    ],
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile-only slim header. Mirrors the admin header chrome that the
          kiosk-mode CSS hides on phones — keeps "Take payment" visible
          but eats only one line of vertical space instead of the full
          admin shell. */}
      <div className="flex items-center justify-between gap-3 pl-12 lg:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dash-faint">
            Lodge admin
          </p>
          <h1 className="truncate text-base font-semibold text-dash-text">
            Take payment
          </h1>
        </div>
        {session ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            New
          </Button>
        ) : null}
      </div>

      {/* Desktop header (unchanged) */}
      <div className="admin-page-head hidden lg:flex">
        <div>
          <h1 className="admin-page-title">Take payment</h1>
          <p className="admin-page-copy">
            Type the amount, show the QR code. The payer scans with their
            phone camera and pays via card, Apple Pay, or Google Pay on
            Mooov&apos;s branded page. Works great on phone, iPad, or laptop.
          </p>
        </div>
        {session ? (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New payment
          </Button>
        ) : null}
      </div>

      {!connected ? (
        <Card className="border-amber-200 bg-amber-50/60 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 flex-none" />
            <div className="space-y-2">
              <p className="font-medium">
                This lodge has not connected its payment processor yet.
              </p>
              <p className="text-sm">
                {mooovStatus === "needs_repair"
                  ? "Your Mooov connection needs repairing before you can take new payments. Visit Integrations to reconnect."
                  : "Connect Mooov from the Integrations page before taking in-person payments."}
              </p>
              <Button asChild size="sm">
                <Link href="/admin/integrations">Open Integrations</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : session ? (
        <ActiveSession
          session={session}
          lodgeSlug={lodgeSlug}
          onStatusChange={setStatus}
          status={status}
          onReset={reset}
        />
      ) : (
        <>
          <AmountForm
            amount={amount}
            setAmount={setAmount}
            category={category}
            setCategory={setCategory}
            reference={reference}
            setReference={setReference}
            description={description}
            setDescription={setDescription}
            memberId={memberId}
            setMemberId={setMemberId}
            members={members}
            error={error}
            minting={minting}
            onSubmit={handleSubmit}
          />
          <HistoryPanel
            items={history}
            loading={historyLoading}
            onRefresh={loadHistory}
            onReopen={reopenFromHistory}
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Amount entry form (mobile-first POS-style keypad + presets + extras)
// ─────────────────────────────────────────────────────────────────────────────

type AmountFormProps = {
  amount: string;
  setAmount: React.Dispatch<React.SetStateAction<string>>;
  category: (typeof CATEGORIES)[number]["id"];
  setCategory: (v: (typeof CATEGORIES)[number]["id"]) => void;
  reference: string;
  setReference: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  memberId: string | null;
  setMemberId: (v: string | null) => void;
  members: MemberOption[];
  error: string | null;
  minting: boolean;
  onSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
};

function AmountForm({
  amount,
  setAmount,
  category,
  setCategory,
  reference,
  setReference,
  description,
  setDescription,
  memberId,
  setMemberId,
  members,
  error,
  minting,
  onSubmit,
}: AmountFormProps) {
  const [showExtras, setShowExtras] = useState(false);

  const displayAmount = useMemo(() => {
    if (!amount) return "0.00";
    const n = Number(amount);
    if (!Number.isFinite(n)) return amount;
    return n.toFixed(amount.includes(".") ? Math.min(2, amount.split(".")[1]?.length ?? 0) : 2);
  }, [amount]);

  const appendDigit = useCallback(
    (digit: string) => {
      setAmount((prev) => {
        if (digit === ".") {
          if (prev.includes(".")) return prev;
          return prev === "" ? "0." : `${prev}.`;
        }
        if (prev === "0" && digit !== ".") return digit;
        const next = prev + digit;
        const [, decimals] = next.split(".");
        if (decimals && decimals.length > 2) return prev;
        if (Number(next) > 5000) return prev;
        return next;
      });
    },
    [setAmount],
  );

  const backspace = useCallback(() => {
    setAmount((prev) => prev.slice(0, -1));
  }, [setAmount]);

  const clearAmount = useCallback(() => {
    setAmount("");
  }, [setAmount]);

  const adjust = useCallback(
    (delta: number) => {
      setAmount((prev) => {
        const current = Number(prev || "0");
        const next = Math.max(0, Math.min(5000, current + delta));
        return next === 0 ? "" : String(Number(next.toFixed(2)));
      });
    },
    [setAmount],
  );

  return (
    <Card className="overflow-hidden p-0">
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 p-4 sm:p-6"
      >
        {/* Big amount display */}
        <div className="rounded-2xl bg-slate-950 px-4 py-6 text-white shadow-inner sm:py-8">
          <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Amount to take
          </p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <span className="text-3xl font-semibold text-slate-300 sm:text-4xl">
              £
            </span>
            <span
              className={cn(
                "tabular-nums font-semibold tracking-tight",
                amount ? "text-white" : "text-slate-500",
                "text-5xl sm:text-6xl",
              )}
            >
              {displayAmount}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => adjust(-5)}
              className="touch-pad inline-flex h-9 items-center gap-1 rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
              aria-label="Decrease by £5"
            >
              <Minus className="h-3.5 w-3.5" /> £5
            </button>
            <button
              type="button"
              onClick={() => adjust(5)}
              className="touch-pad inline-flex h-9 items-center gap-1 rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
              aria-label="Increase by £5"
            >
              <Plus className="h-3.5 w-3.5" /> £5
            </button>
            <button
              type="button"
              onClick={() => adjust(10)}
              className="touch-pad inline-flex h-9 items-center gap-1 rounded-full bg-slate-800/80 px-3 text-xs font-medium text-slate-200 hover:bg-slate-700"
              aria-label="Increase by £10"
            >
              <Plus className="h-3.5 w-3.5" /> £10
            </button>
            {amount ? (
              <button
                type="button"
                onClick={clearAmount}
                className="touch-pad inline-flex h-9 items-center gap-1 rounded-full bg-red-500/15 px-3 text-xs font-medium text-red-300 hover:bg-red-500/25"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {/* Preset chips (wrap on phone, single row on tablet+) */}
        <div className="flex flex-wrap justify-center gap-2">
          {PRESET_AMOUNTS.map((preset) => (
            <button
              key={preset}
              type="button"
              className="touch-pad min-h-11 min-w-[3.5rem] rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
              onClick={() => setAmount(String(preset))}
            >
              £{preset}
            </button>
          ))}
        </div>

        {/* Built-in keypad — touch-friendly and works on every device,
            no native keyboard pushing the rest of the page around. */}
        <Keypad onDigit={appendDigit} onBackspace={backspace} />

        {/* Member attribution. Optional — leaving it blank treats the
            payer as a guest, which is exactly what we want for raffles
            and one-off festive-board top-ups at the bar. Picking a
            member fills in user_name/email on the payments row and
            auto-attaches their Gift Aid declaration if one exists. */}
        <MemberPicker
          members={members}
          memberId={memberId}
          setMemberId={setMemberId}
        />

        {/* Hidden input keeps form semantics + accessibility */}
        <Input
          aria-label="Amount"
          type="hidden"
          value={amount}
          readOnly
        />

        {/* Collapsible extras: category / reference / description.
            Treasurer just wants to take a tenner — keep the chrome minimal
            by default and let them open extras only when needed. */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setShowExtras((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-slate-700"
            aria-expanded={showExtras}
          >
            <span>
              {showExtras ? "Hide" : "Add"} category, reference, or receipt
              note
            </span>
            <span className="text-xs text-slate-500">
              {category !== "general" || reference || description
                ? "Filled in"
                : "Optional"}
            </span>
          </button>
          {showExtras ? (
            <div className="space-y-4 border-t border-slate-200 p-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as (typeof CATEGORIES)[number]["id"])
                  }
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Reference (optional)</Label>
                <Input
                  id="reference"
                  type="text"
                  placeholder="Bro. Smith — raffle prize"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={120}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="ios-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">
                  Description on receipt (optional)
                </Label>
                <Input
                  id="description"
                  type="text"
                  placeholder="Festive Board top-up — 5 June"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={140}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  className="ios-input"
                />
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <TriangleAlert className="h-4 w-4 flex-none" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button
          type="submit"
          size="xl"
          disabled={minting || !amount || Number(amount) <= 0}
          className="w-full text-base"
        >
          {minting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Generating QR…
            </>
          ) : (
            <>
              <Banknote className="mr-2 h-5 w-5" />
              Generate QR code
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          The QR is single-use and tied to the amount you typed above. If the
          payer doesn&apos;t scan within 24 hours it expires automatically.
        </p>
      </form>
    </Card>
  );
}

function MemberPicker({
  members,
  memberId,
  setMemberId,
}: {
  members: MemberOption[];
  memberId: string | null;
  setMemberId: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => members.find((m) => m.id === memberId) ?? null,
    [members, memberId],
  );

  // Lock body scroll while the sheet is open so iOS Safari doesn't
  // double-scroll (the underlying page + the sheet). Standard mobile
  // app behaviour.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Lodge member counts are typically small (<100), so a client-side
  // filter beats a debounced search round-trip on flaky meeting Wi-Fi.
  const filtered = useMemo(() => {
    if (!query.trim()) return members.slice(0, 100);
    const q = query.trim().toLowerCase();
    return members
      .filter((m) => {
        const name = m.full_name.toLowerCase();
        const email = (m.email ?? "").toLowerCase();
        return name.includes(q) || email.includes(q);
      })
      .slice(0, 100);
  }, [members, query]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <User className="h-4 w-4 text-emerald-700" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-emerald-900">
              {selected.full_name}
            </p>
            {selected.email ? (
              <p className="truncate text-xs text-emerald-800/80">
                {selected.email}
              </p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMemberId(null);
            setQuery("");
          }}
          aria-label="Clear member"
          className="touch-pad shrink-0 rounded-md p-1.5 text-emerald-800/80 hover:bg-emerald-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="touch-pad flex w-full items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="flex min-w-0 items-center gap-2">
          <UserX className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="truncate text-slate-700">
            Guest payment{" "}
            <span className="text-slate-400">· no member attached</span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-blue-600">
          Attach member
        </span>
      </button>
      <p className="px-1 text-xs text-slate-500">
        Optional. Leave blank for a guest payment, or attach a member so the
        ledger and any Gift Aid declaration are logged automatically.
      </p>

      {/* Full-screen native-style sheet. Positioned fixed so the iOS
          keyboard pushes it up naturally without breaking the page layout
          underneath, and the search input is set to 16px so iOS Safari
          does NOT auto-zoom on focus (the cause of the "page zooms and
          disfigures" feedback). */}
      {open ? (
        <MemberPickerSheet
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          onPick={(m) => {
            setMemberId(m.id);
            setQuery("");
            setOpen(false);
          }}
          onClose={() => {
            setQuery("");
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function MemberPickerSheet({
  query,
  setQuery,
  filtered,
  onPick,
  onClose,
}: {
  query: string;
  setQuery: (v: string) => void;
  filtered: MemberOption[];
  onPick: (m: MemberOption) => void;
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Defer focus a tick so the sheet animates in before the iOS keyboard
    // jumps up; otherwise the layout can flash.
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Attach member"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "flex w-full flex-col bg-white shadow-2xl",
          // Phone: bottom sheet with rounded top + safe-area aware.
          "max-h-[85dvh] rounded-t-2xl pb-[env(safe-area-inset-bottom)]",
          // Tablet+: a centred card.
          "sm:max-h-[70vh] sm:max-w-md sm:rounded-2xl sm:pb-0",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Attach member</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="touch-pad rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ios-input w-full bg-transparent outline-none placeholder:text-slate-400"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="touch-pad rounded-md p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <ul className="flex-1 overflow-y-auto overscroll-contain">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-slate-500">
              {query.trim()
                ? `No members match "${query}".`
                : "No active members in this lodge yet."}
            </li>
          ) : (
            filtered.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="touch-pad flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {m.full_name}
                    </p>
                    {m.email ? (
                      <p className="truncate text-xs text-slate-500">
                        {m.email}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function Keypad({
  onDigit,
  onBackspace,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
}) {
  const keys: Array<{ label: React.ReactNode; value: string; onClick?: () => void; aria?: string }> = [
    { label: "1", value: "1" },
    { label: "2", value: "2" },
    { label: "3", value: "3" },
    { label: "4", value: "4" },
    { label: "5", value: "5" },
    { label: "6", value: "6" },
    { label: "7", value: "7" },
    { label: "8", value: "8" },
    { label: "9", value: "9" },
    { label: ".", value: "." },
    { label: "0", value: "0" },
    {
      label: <Delete className="h-5 w-5" />,
      value: "back",
      onClick: onBackspace,
      aria: "Backspace",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:max-w-md sm:mx-auto sm:w-full">
      {keys.map((k) => (
        <button
          key={k.value}
          type="button"
          aria-label={k.aria ?? `Digit ${k.value}`}
          onClick={k.onClick ?? (() => onDigit(k.value))}
          className={cn(
            "touch-pad flex h-14 items-center justify-center rounded-xl border border-slate-200 bg-white text-2xl font-semibold text-slate-800 shadow-sm transition-transform active:scale-[0.97] active:bg-slate-100 sm:h-16 sm:text-3xl",
            k.value === "back" && "text-slate-500",
          )}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active session — QR display, status, share, fullscreen
// ─────────────────────────────────────────────────────────────────────────────

type ActiveSessionProps = {
  session: {
    paymentId: string;
    url: string;
    qrDataUrl: string;
    amountMinor: number;
    currency: string;
    reference: string;
    description: string;
    memberName: string | null;
    giftAidEligible: boolean;
  };
  lodgeSlug: string;
  status: StatusResponse | null;
  onStatusChange: (s: StatusResponse | null) => void;
  onReset: () => void;
};

function ActiveSession({
  session,
  status,
  onStatusChange,
  onReset,
}: ActiveSessionProps) {
  const stopRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const phase: StatusPhase = status?.phase ?? "pending";
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shareError, setShareError] = useState<string | null>(null);

  // Poll status every 2s until terminal. Honest: we don't claim "card entered"
  // unless we actually have a webhook-driven succeeded/failed phase to back
  // it up. Mooov doesn't emit a card-submitted event so the only thing we
  // can truthfully show before terminal is "waiting".
  useEffect(() => {
    stopRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (stopRef.current) return;
      try {
        const res = await fetch(
          `/api/admin/take-payment/status/${encodeURIComponent(session.paymentId)}`,
          { cache: "no-store" },
        );
        if (res.ok) {
          const body = (await res.json()) as StatusResponse;
          onStatusChange(body);
          if (body.phase === "succeeded" || body.phase === "failed") {
            return;
          }
        }
      } catch {
        // Swallow transient errors; next tick will retry.
      }
      timer = setTimeout(poll, 2000);
    };

    void poll();
    return () => {
      stopRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [session.paymentId, onStatusChange]);

  // Elapsed timer ticks once a second so the admin can see "we've been
  // waiting 32s" without guessing.
  useEffect(() => {
    if (phase === "succeeded" || phase === "failed") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Wake Lock — keep the screen on while a QR is being shown. Re-acquire on
  // visibility change because mobile browsers (iOS especially) release the
  // lock the moment the page is hidden. Guarded everywhere; missing API or
  // failed acquire is non-fatal.
  useEffect(() => {
    if (phase === "succeeded" || phase === "failed") return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const nav = navigator as Navigator & {
          wakeLock?: {
            request: (type: "screen") => Promise<WakeLockSentinel>;
          };
        };
        if (!nav.wakeLock) return;
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) {
          await lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
      } catch {
        // Permission denied or unsupported; ignore.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {});
      sentinel = null;
    };
  }, [phase]);

  // Track fullscreen state in case the user exits via Esc / system gesture.
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // iOS Safari sometimes refuses; fall back gracefully.
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShareError("Could not copy the link.");
    }
  }, [session.url]);

  const handleShare = useCallback(async () => {
    setShareError(null);
    const text =
      `Pay ${formatMoney(session.amountMinor, session.currency)} via secure ` +
      `card link${session.description ? ` (${session.description})` : ""}`;
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as Navigator & {
          share: (data: { title: string; text: string; url: string }) => Promise<void>;
        }).share({
          title: "Payment link",
          text,
          url: session.url,
        });
        return;
      }
      // Fallback: SMS via tel/sms scheme works on mobile browsers.
      const sms = `sms:?&body=${encodeURIComponent(`${text}\n${session.url}`)}`;
      window.location.href = sms;
    } catch {
      // User likely cancelled the share sheet; not an error worth surfacing.
    }
  }, [session.amountMinor, session.currency, session.description, session.url]);

  const amountLabel = useMemo(
    () => formatMoney(session.amountMinor, session.currency),
    [session.amountMinor, session.currency],
  );

  if (phase === "succeeded") {
    const completedAt = status?.projected?.completed_at;
    return (
      <Card className="space-y-4 border-emerald-200 bg-emerald-50/40 p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600 sm:h-20 sm:w-20" />
        <div>
          <h2 className="text-3xl font-semibold text-emerald-900 sm:text-4xl">
            Paid {amountLabel}
          </h2>
          {completedAt ? (
            <p className="mt-1 text-sm text-emerald-800">
              {new Date(completedAt).toLocaleString("en-GB")}
            </p>
          ) : (
            <p className="mt-1 text-sm text-emerald-800">
              Payment captured. Receipt sent by Mooov.
            </p>
          )}
          <p className="mt-2 text-xs text-emerald-700/80">
            Ref: {session.paymentId}
          </p>
        </div>
        <div className="flex justify-center gap-2">
          <Button onClick={onReset} size="lg">
            <RotateCcw className="mr-2 h-5 w-5" />
            Take another payment
          </Button>
        </div>
      </Card>
    );
  }

  if (phase === "failed") {
    return (
      <Card className="space-y-4 border-red-200 bg-red-50/40 p-6 text-center sm:p-10">
        <TriangleAlert className="mx-auto h-16 w-16 text-red-600 sm:h-20 sm:w-20" />
        <div>
          <h2 className="text-2xl font-semibold text-red-900 sm:text-3xl">
            Payment did not complete
          </h2>
          <p className="mt-1 text-sm text-red-800">
            {humanizeFailureReason(status?.failure_reason)}
          </p>
          <p className="mt-2 text-xs text-red-700/80">
            Ref: {session.paymentId}
          </p>
        </div>
        <Button onClick={onReset} size="lg">
          <RotateCcw className="mr-2 h-5 w-5" />
          Start over
        </Button>
      </Card>
    );
  }

  return (
    <Card
      ref={containerRef}
      className={cn(
        "space-y-5 p-4 sm:p-6",
        // In fullscreen, paint the whole viewport white so the QR has max
        // contrast on every device. Use 100dvh + safe-area insets so iOS
        // Safari's collapsing URL bar and the home indicator don't crop
        // the QR.
        isFullscreen &&
          "fixed inset-0 z-50 m-0 h-[100dvh] max-h-none max-w-none rounded-none border-0 bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-center sm:text-left">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Show this QR to the payer
          </p>
          <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {amountLabel}
          </h2>
          {(session.reference || session.description) && (
            <p className="mt-1 text-xs text-muted-foreground">
              {session.description || session.reference}
            </p>
          )}
          {(session.memberName || session.giftAidEligible) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {session.memberName ? (
                <Badge variant="outline" className="gap-1 border-slate-300">
                  <User className="h-3 w-3" />
                  {session.memberName}
                </Badge>
              ) : null}
              {session.giftAidEligible ? (
                <Badge variant="success" className="gap-1">
                  <HeartHandshake className="h-3 w-3" />
                  Gift Aid auto-logged
                </Badge>
              ) : null}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="shrink-0"
        >
          {isFullscreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        className={cn(
          "mx-auto w-full",
          isFullscreen ? "max-w-2xl" : "max-w-sm sm:max-w-md",
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={session.qrDataUrl}
          alt={`Payment QR code for ${amountLabel}`}
          className="block aspect-square w-full h-auto rounded-2xl border-4 border-white bg-white shadow-md"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={handleShare}
          className="flex-1 sm:flex-initial"
        >
          <Share2 className="mr-2 h-4 w-4" />
          Share link
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleCopy}
          className="flex-1 sm:flex-initial"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? "Copied!" : "Copy link"}
        </Button>
      </div>

      {shareError ? (
        <p className="text-center text-xs text-red-700">{shareError}</p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
        <div className="flex items-start gap-2">
          <ScanLine className="h-5 w-5 flex-none text-slate-500" />
          <div className="space-y-1">
            <p className="font-medium text-slate-800">How to pay</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-slate-600">
              <li>Open the camera on a phone.</li>
              <li>Point it at this QR code.</li>
              <li>Tap the link to pay with card, Apple Pay, or Google Pay.</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for payment…
        </div>
        <p className="text-xs text-muted-foreground/80">
          Elapsed {formatElapsed(elapsed)}
          {" · "}
          Auto-checks every 2&nbsp;seconds
        </p>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Open link manually</summary>
        <p className="mt-2 break-all rounded border bg-background p-2 font-mono">
          {session.url}
        </p>
      </details>

      <div className="flex justify-center gap-2">
        <Button variant="outline" onClick={onReset}>
          Cancel and start over
        </Button>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Recent QR codes panel
// ─────────────────────────────────────────────────────────────────────────────

function HistoryPanel({
  items,
  loading,
  onRefresh,
  onReopen,
}: {
  items: HistoryItem[];
  loading: boolean;
  onRefresh: () => void;
  onReopen: (item: HistoryItem) => void;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = useCallback(
    async (paymentId: string) => {
      setCancellingId(paymentId);
      try {
        const res = await fetch("/api/admin/take-payment/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_id: paymentId }),
        });
        if (res.ok) {
          onRefresh();
        }
      } catch {
        // Best-effort; user can retry.
      } finally {
        setCancellingId(null);
      }
    },
    [onRefresh],
  );

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-800">
            Recent QR codes
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
          className="h-8 px-2"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 text-slate-500",
              loading && "animate-spin",
            )}
          />
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-slate-500 sm:px-6">
          {loading
            ? "Loading recent QRs…"
            : "No QR codes have been generated yet. Take your first payment above."}
        </div>
      ) : (
        <ul className="divide-y divide-slate-200">
          {items.map((item) => (
            <HistoryRow
              key={item.payment_id}
              item={item}
              onReopen={() => onReopen(item)}
              onCancel={() => handleCancel(item.payment_id)}
              cancelling={cancellingId === item.payment_id}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function HistoryRow({
  item,
  onReopen,
  onCancel,
  cancelling,
}: {
  item: HistoryItem;
  onReopen: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!item.hosted_url) return;
    try {
      await navigator.clipboard.writeText(item.hosted_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [item.hosted_url]);

  const amountLabel = formatMoney(item.amount_minor, item.currency);
  const created = new Date(item.created_at);

  return (
    <li className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4 sm:px-5">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums text-slate-900">
            {amountLabel}
          </span>
          <DerivedStatusPill status={item.derived_status} />
          {item.category && item.category !== "general" ? (
            <Badge variant="outline" className="border-slate-300 capitalize">
              {item.category.replace(/_/g, " ")}
            </Badge>
          ) : null}
          {item.gift_aid_eligible ? (
            <Badge variant="success" className="gap-1">
              <HeartHandshake className="h-3 w-3" />
              Gift Aid
            </Badge>
          ) : null}
        </div>
        {(item.description || item.reference) && (
          <p className="truncate text-sm text-slate-600">
            {item.description || item.reference}
          </p>
        )}
        <p className="text-xs text-slate-500">
          {created.toLocaleString("en-GB")}
          {item.created_by_email ? ` · by ${item.created_by_email}` : ""}
        </p>
        {item.member_name ? (
          <p className="flex items-center gap-1 text-xs text-slate-700">
            <User className="h-3 w-3" />
            For {item.member_name}
            {item.member_email ? ` (${item.member_email})` : ""}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <UserX className="h-3 w-3" />
            Guest payment
          </p>
        )}
        {item.derived_status === "paid" &&
        (item.paid_by_name || item.paid_by_email) &&
        // Avoid showing the same line twice when the member matches the
        // captured-payment attribution. Only surface "Paid by" when it
        // adds new info (e.g. guest payment with payer-entered name).
        !item.member_name ? (
          <p className="text-xs text-emerald-700">
            Paid by {item.paid_by_name ?? item.paid_by_email}
            {item.paid_at
              ? ` · ${new Date(item.paid_at).toLocaleString("en-GB")}`
              : ""}
          </p>
        ) : null}
        {item.derived_status === "paid" && item.paid_at ? (
          <p className="text-xs text-emerald-700">
            Captured {new Date(item.paid_at).toLocaleString("en-GB")}
          </p>
        ) : null}
        {item.derived_status === "failed" && item.failure_reason ? (
          <p className="text-xs text-red-700">
            {humanizeFailureReason(item.failure_reason)}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
        {item.derived_status === "open" && item.hosted_url ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReopen}
          >
            Show QR
          </Button>
        ) : null}
        {item.hosted_url ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy link"
          >
            <Copy className="mr-1 h-3.5 w-3.5" />
            {copied ? "Copied" : "Link"}
          </Button>
        ) : null}
        {item.derived_status === "open" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={cancelling}
            aria-label="Cancel this QR"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {cancelling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <XCircle className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function DerivedStatusPill({ status }: { status: HistoryDerived }) {
  switch (status) {
    case "paid":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Paid
        </Badge>
      );
    case "open":
      return (
        <Badge variant="warning" className="gap-1">
          <Clock className="h-3 w-3" />
          Open
        </Badge>
      );
    case "expired":
      return (
        <Badge variant="muted" className="gap-1">
          <Clock className="h-3 w-3" />
          Expired
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="muted" className="gap-1">
          <XCircle className="h-3 w-3" />
          Cancelled
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1">
          <TriangleAlert className="h-3 w-3" />
          Failed
        </Badge>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      minimumFractionDigits: 2,
    }).format(minor / 100);
  } catch {
    return `£${(minor / 100).toFixed(2)}`;
  }
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

function humanizeFailureReason(reason: string | null | undefined): string {
  if (!reason) return "The payer cancelled or the card was declined.";
  switch (reason) {
    case "cancelled_by_admin":
      return "Cancelled by admin.";
    case "unexpected_error":
      return "Something went wrong when creating the payment session.";
    case "merchant_setup_required":
      return "Lodge payment processor needs setup.";
    default:
      return reason.replace(/_/g, " ");
  }
}
