"use client";

import { useState } from "react";
import { CreditCard, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicDuesPayClient({
  duesId,
  memberEmail,
  memberName,
  allowInstalments,
}: {
  duesId: string;
  memberEmail: string;
  memberName: string | null;
  allowInstalments: boolean;
}) {
  const [paying, setPaying] = useState<"payment" | "subscription" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(mode: "payment" | "subscription") {
    setPaying(mode);
    setError(null);
    try {
      const res = await fetch("/api/dues/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dues_id: duesId,
          member_email: memberEmail,
          member_name: memberName,
          mode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Could not start payment.");
      }
      window.location.href = data.url;
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Could not start payment.");
      setPaying(null);
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={Boolean(paying)}
        onClick={() => pay("payment")}
      >
        <CreditCard className="mr-2 h-4 w-4" />
        {paying === "payment" ? "Redirecting..." : "Pay in full"}
      </Button>
      {allowInstalments && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          className="w-full"
          disabled={Boolean(paying)}
          onClick={() => pay("subscription")}
        >
          <Repeat className="mr-2 h-4 w-4" />
          {paying === "subscription" ? "Redirecting..." : "Pay by instalments"}
        </Button>
      )}
    </div>
  );
}
