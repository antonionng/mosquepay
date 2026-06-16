"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  token: string;
  eventId: string;
  eventTitle: string;
};

export function NewcomerBookButton({ token, eventId, eventTitle }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function book() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch(
        `/api/newcomers/mosque/${encodeURIComponent(token)}/book/${encodeURIComponent(
          eventId
        )}`,
        { method: "POST" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          body?.error ?? `Could not start booking for ${eventTitle}.`
        );
      }
      if (body?.url) {
        window.location.href = body.url as string;
        return;
      }
      throw new Error("No booking URL returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={book}
        disabled={pending}
      >
        {pending ? "Loading..." : "Book me in"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
