"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  token: string;
  initial: {
    full_name: string;
    email: string;
    phone: string;
    dietary_requirements: string;
  };
};

export function NewcomerDetailsForm({ token, initial }: Props) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const dirty =
    values.full_name !== initial.full_name ||
    values.email !== initial.email ||
    values.phone !== initial.phone ||
    values.dietary_requirements !== initial.dietary_requirements;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/newcomers/mosque/${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error ?? "Could not save your details.");
      }
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="full_name">Your name</Label>
          <Input
            id="full_name"
            value={values.full_name}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, full_name: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            type="tel"
            value={values.phone}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="dietary_requirements">
            Dietary requirements / accessibility
          </Label>
          <Textarea
            id="dietary_requirements"
            rows={3}
            value={values.dietary_requirements}
            onChange={(e) =>
              setValues((prev) => ({
                ...prev,
                dietary_requirements: e.target.value,
              }))
            }
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : status === "saved" ? (
        <p className="text-sm font-medium text-emerald-700">
          Details saved. Thank you.
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="primary"
          disabled={pending || !dirty}
        >
          {pending ? "Saving..." : "Save details"}
        </Button>
      </div>
    </form>
  );
}
