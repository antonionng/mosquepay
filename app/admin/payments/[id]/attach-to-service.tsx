"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";

type EventOption = {
  id: string;
  title: string;
  event_date: string;
};

const NONE = "__none__";

/**
 * Treasurer "fix-up" panel on the payment detail page. Lets an admin
 * attach a cash/QR payment to a service after the fact when the duty
 * officer forgot to pick one in the take-payment flow. Posts to
 * /api/admin/payments/[id] which validates the event belongs to the
 * active church.
 */
export function AttachToServiceCard({
  paymentId,
  currentEventId,
  events,
}: {
  paymentId: string;
  currentEventId: string | null;
  events: EventOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>(currentEventId ?? NONE);
  const [error, setError] = useState<string | null>(null);

  const dirty = (currentEventId ?? NONE) !== selected;

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: selected === NONE ? null : selected,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? "Could not update.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="attach-event">Attach to service</Label>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger id="attach-event">
          <SelectValue placeholder="No service" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>No service</SelectItem>
          {events.map((event) => (
            <SelectItem key={event.id} value={event.id}>
              {event.title} · {formatDate(event.event_date)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-dash-text-muted">
        Linking a cash or QR payment to a service rolls it into the
        service&apos;s &quot;Money raised&quot; total.
      </p>
      {error ? (
        <p className="text-xs text-rose-700">{error}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        onClick={() => void save()}
        disabled={!dirty || busy || pending}
      >
        {busy || pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
          </>
        ) : selected === NONE ? (
          "Detach"
        ) : (
          "Save link"
        )}
      </Button>
    </div>
  );
}
