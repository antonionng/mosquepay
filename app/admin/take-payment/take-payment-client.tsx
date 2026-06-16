"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, CheckCircle2, RotateCcw, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabBar } from "./components/tab-bar";
import { KioskLinkCard } from "./components/kiosk-link-card";
import { ChargeTab, generateQrForUrl } from "./components/charge-tab";
import { CashTab } from "./components/cash-tab";
import { HistoryTab } from "./components/history-tab";
import {
  AdvanceGivingDialog,
  type AdvanceGivingCashResult,
  type AdvanceGivingQrResult,
} from "./components/advance-giving-dialog";
import type { ActiveSessionState } from "./components/active-session";
import type {
  CategoryId,
  EventOption,
  HistoryItem,
  LineItemDraft,
  MemberOption,
  PayerSelection,
  StatusResponse,
  TabId,
} from "./components/types";
import { CATEGORIES } from "./components/types";

type Props = {
  connected: boolean;
  mooovStatus: string | null;
  members: MemberOption[];
  /** Recent + upcoming events for the optional "Link to service" picker. */
  events: EventOption[];
  /** Slug for the public self-service kiosk link card. */
  mosqueSlug: string | null;
};

// Take-payment shell. Owns:
//   * Form state (amount, category, reference, description, memberId)
//     — kept at this level so switching tabs doesn't lose what you typed.
//   * Active QR session (so "Show QR" from History can mount it).
//   * History list + open-QR count (drives the Recent badge in the TabBar).
//   * Tab routing (URL search param state).

export function TakePaymentClient({
  connected,
  mooovStatus,
  members,
  events,
  mosqueSlug,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab state from URL. Default: charge.
  const tabFromUrl: TabId = (() => {
    const raw = searchParams.get("tab");
    if (raw === "cash" || raw === "history") return raw;
    return "charge";
  })();
  const [tab, setTabState] = useState<TabId>(tabFromUrl);
  // Optional focus param so the cash tab can deep-link "scroll to my entry"
  // when the undo window expires and the user is sent to History.
  const focusId = searchParams.get("focus");

  // Optional deep-link params:
  //   ?event_id=<uuid>  preselects the service on the picker
  //   ?category=<id>    preselects the contribution category
  // Both come from the service detail page's "Take a payment for this
  // service" CTAs so the duty officer lands on a pre-filled form.
  // Auto-suggest today's Jumu'ah when there's exactly one on, so the operator
  // confirms rather than has to remember. A deep-linked ?event_id wins; an
  // explicit choice later overrides either.
  const todaysServiceId = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const todays = events.filter(
      (event) => event.event_date.slice(0, 10) === today,
    );
    return todays.length === 1 ? todays[0].id : null;
  })();
  const initialEventId = (() => {
    const raw = searchParams.get("event_id");
    if (raw) return events.find((event) => event.id === raw) ? raw : null;
    return todaysServiceId;
  })();
  const initialCategory: CategoryId = (() => {
    const raw = searchParams.get("category");
    if (!raw) return "general";
    const known = CATEGORIES.find((c) => c.id === raw);
    return known ? (raw as CategoryId) : "general";
  })();

  const setTab = useCallback(
    (next: TabId, opts?: { focus?: string }) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams.toString());
      if (next === "charge") {
        params.delete("tab");
      } else {
        params.set("tab", next);
      }
      if (opts?.focus) {
        params.set("focus", opts.focus);
      } else {
        params.delete("focus");
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // Keep tab in lockstep with the URL if the user hits the back button.
  useEffect(() => {
    if (tabFromUrl !== tab) setTabState(tabFromUrl);
  }, [tabFromUrl, tab]);

  // Form state — shared across tabs so switching doesn't blow away the
  // amount you just typed. Memo-isolated so we don't accidentally pull
  // it into every child's re-render cycle.
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryId>(initialCategory);
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  // Optional itemised basket (split a single payment across raffle / charity /
  // dining). Lifted here so it survives switching between the Charge and Cash
  // tabs, like the rest of the form state. Empty array == single-amount mode.
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([]);
  // Optional event linkage shared across tabs so switching Charge/Cash
  // doesn't lose the picked service. Driven by deep-link params on mount.
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  // Unified payer state — member, existing guest, inline-new guest, or
  // anonymous. Shared between Charge and Cash so a treasurer who picked a
  // guest in Cash sees the same guest selected if they switch to Charge.
  const [payer, setPayer] = useState<PayerSelection>({ kind: "anonymous" });

  // Active QR session (Charge tab) — lifted so HistoryTab can drop a
  // re-opened QR straight in here without prop chains.
  const [session, setSession] = useState<ActiveSessionState | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);

  // History list + open count.
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Advance giving dialog state. The dialog handles next-year resolution
  // server-side via /api/admin/take-payment/advance-giving. On QR mint we
  // promote the result into a regular ActiveSessionState so the existing
  // Charge tab QR card renders it; on cash record we surface a
  // dismissible green toast.
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceCashToast, setAdvanceCashToast] =
    useState<AdvanceGivingCashResult | null>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/admin/take-payment/history?limit=60", {
        cache: "no-store",
      });
      if (res.ok) {
        const body = (await res.json()) as { items: HistoryItem[] };
        setHistory(body.items ?? []);
      }
    } catch {
      // Non-fatal; the tab keeps its previous list.
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      void loadHistory();
    }
  }, [connected, loadHistory]);

  const handleAdvanceQrReady = useCallback(
    async (
      result: AdvanceGivingQrResult,
      member: { id: string; full_name: string; email: string | null }
    ) => {
      try {
        const qrDataUrl = await generateQrForUrl(result.url);
        setSession({
          paymentId: result.payment_id,
          url: result.url,
          qrDataUrl,
          amountMinor: Math.round(result.amount * 100),
          currency: result.currency,
          reference: "Advance giving",
          description: "Advance giving for next year",
          memberName: member.full_name,
          giftAidEligible: false,
          payerKind: "member",
          payerEmail: member.email ?? null,
          memberId: member.id,
          category: "subscriptions",
        });
        setStatus(null);
        setTab("charge");
      } catch (err) {
        console.error("advance giving QR mount failed", err);
      }
    },
    [setTab]
  );

  const handleAdvanceCashRecorded = useCallback(
    (result: AdvanceGivingCashResult) => {
      setAdvanceCashToast(result);
      void loadHistory();
    },
    [loadHistory]
  );

  // Refresh history once a session reaches a terminal phase, so the
  // "Recent" tab shows the just-completed payment.
  useEffect(() => {
    if (status?.phase === "succeeded" || status?.phase === "failed") {
      void loadHistory();
    }
  }, [status?.phase, loadHistory]);

  const openCount = useMemo(
    () => history.filter((h) => h.derived_status === "open").length,
    [history],
  );

  const reopenFromHistory = useCallback(
    async (item: HistoryItem) => {
      if (!item.hosted_url) return;
      try {
        const qrDataUrl = await generateQrForUrl(item.hosted_url);
        // Re-opening a QR from history: we don't know the original
        // PayerSelection.kind, so we infer from member_id (member if
        // present, otherwise guest if there's an email, otherwise
        // anonymous). Category falls back to "general" if the stored
        // string doesn't match a known CategoryId -- the on-screen GA
        // nudge will simply not show, which is the right behaviour.
        const knownCategory = CATEGORIES.find(
          (c) => c.id === item.category,
        )?.id as CategoryId | undefined;
        const inferredKind: PayerSelection["kind"] = item.member_id
          ? "member"
          : item.paid_by_email || item.member_email
            ? "guest"
            : "anonymous";
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
          payerKind: inferredKind,
          payerEmail: item.member_email ?? item.paid_by_email ?? null,
          memberId: item.member_id,
          category: knownCategory ?? "general",
        });
        setStatus(null);
        setTab("charge");
      } catch (err) {
        console.error("re-open qr failed", err);
      }
    },
    [setTab],
  );

  const handleHistoryAction = useCallback(
    async (item: HistoryItem) => {
      try {
        const res = await fetch("/api/admin/take-payment/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_id: item.payment_id }),
        });
        if (res.ok) {
          await loadHistory();
        }
      } catch {
        // Best-effort; the user can retry.
      }
    },
    [loadHistory],
  );

  // Connection guard. Same as before — applies across all tabs.
  if (!connected) {
    return (
      <Shell session={session} onReset={() => setSession(null)}>
        <Card className="border-amber-200 bg-amber-50/60 p-6 text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 flex-none" />
            <div className="space-y-2">
              <p className="font-medium">
                This mosque has not connected its payment processor yet.
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
      </Shell>
    );
  }

  return (
    <Shell session={session} onReset={() => setSession(null)}>
      {advanceCashToast ? (
        <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" />
          <div className="flex-1">
            <div className="font-medium">
              Advance giving recorded for {advanceCashToast.payer_name ?? "member"}
            </div>
            <div className="text-xs text-emerald-800">
              {advanceCashToast.next_year_label} ·{" "}
              £{(advanceCashToast.amount / 100).toFixed(2)} cash
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAdvanceCashToast(null)}
          >
            Dismiss
          </Button>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAdvanceOpen(true)}
        >
          <CalendarPlus className="mr-2 h-4 w-4" />
          Charge advance giving
        </Button>
      </div>

      <AdvanceGivingDialog
        open={advanceOpen}
        onOpenChange={setAdvanceOpen}
        members={members}
        initialMemberId={
          payer.kind === "member" ? payer.member.id : null
        }
        onQrReady={handleAdvanceQrReady}
        onCashRecorded={handleAdvanceCashRecorded}
      />

      <TabBar
        value={tab}
        onChange={(next) => setTab(next)}
        openCount={openCount}
      />
      {tab === "charge" ? (
        <ChargeTab
          members={members}
          events={events}
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          eventId={eventId}
          setEventId={setEventId}
          eventAutoSelected={eventId != null && eventId === todaysServiceId}
          payer={payer}
          setPayer={setPayer}
          lineItems={lineItems}
          setLineItems={setLineItems}
          session={session}
          setSession={setSession}
          status={status}
          setStatus={setStatus}
          onSessionMinted={loadHistory}
        />
      ) : null}
      {tab === "cash" ? (
        <CashTab
          members={members}
          events={events}
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          eventId={eventId}
          setEventId={setEventId}
          eventAutoSelected={eventId != null && eventId === todaysServiceId}
          payer={payer}
          setPayer={setPayer}
          lineItems={lineItems}
          setLineItems={setLineItems}
          onLogged={loadHistory}
          onJumpToHistory={(paymentId) =>
            setTab("history", { focus: paymentId })
          }
        />
      ) : null}
      {tab === "history" ? (
        <HistoryTab
          items={history}
          loading={historyLoading}
          onRefresh={loadHistory}
          onReopen={reopenFromHistory}
          onAction={handleHistoryAction}
          focusId={focusId}
        />
      ) : null}

      {mosqueSlug ? <KioskLinkCard mosqueSlug={mosqueSlug} /> : null}
    </Shell>
  );
}

// Slim header + page chrome that's identical across all guard / tab states.
// Mobile uses a one-line header to claw back vertical space; desktop keeps
// the full admin-page-head treatment.
function Shell({
  session,
  onReset,
  children,
}: {
  session: ActiveSessionState | null;
  onReset: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5 sm:space-y-6">
      <div className="flex items-center justify-between gap-3 px-1 lg:hidden">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-dash-faint">
            Mosque admin
          </p>
          <h1 className="truncate text-base font-semibold text-dash-text">
            Take payment
          </h1>
        </div>
        {session ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-4 w-4" />
            New
          </Button>
        ) : null}
      </div>
      <div className="admin-page-head hidden lg:flex">
        <div>
          <h1 className="admin-page-title">Take payment</h1>
          <p className="admin-page-copy">
            Type the amount, generate a QR or log cash. Members get auto-
            attribution and Gift Aid; the Recent tab tracks open, paid, and
            voided entries together.
          </p>
        </div>
        {session ? (
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            New payment
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
