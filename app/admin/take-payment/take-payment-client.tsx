"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TabBar } from "./components/tab-bar";
import { ChargeTab, generateQrForUrl } from "./components/charge-tab";
import { CashTab } from "./components/cash-tab";
import { HistoryTab } from "./components/history-tab";
import type { ActiveSessionState } from "./components/active-session";
import type {
  CategoryId,
  HistoryItem,
  MemberOption,
  PayerSelection,
  StatusResponse,
  TabId,
} from "./components/types";

type Props = {
  connected: boolean;
  mooovStatus: string | null;
  members: MemberOption[];
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
  const [category, setCategory] = useState<CategoryId>("general");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
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
      </Shell>
    );
  }

  return (
    <Shell session={session} onReset={() => setSession(null)}>
      <TabBar
        value={tab}
        onChange={(next) => setTab(next)}
        openCount={openCount}
      />
      {tab === "charge" ? (
        <ChargeTab
          members={members}
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          payer={payer}
          setPayer={setPayer}
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
          amount={amount}
          setAmount={setAmount}
          category={category}
          setCategory={setCategory}
          reference={reference}
          setReference={setReference}
          description={description}
          setDescription={setDescription}
          payer={payer}
          setPayer={setPayer}
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
            Lodge admin
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
