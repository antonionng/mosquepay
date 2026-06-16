"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type GuestFormValues = {
  full_name: string;
  email: string;
  phone: string;
  mother_mosque_name: string;
  mother_mosque_number: string;
  constitution: string;
  rank: string;
  dietary_requirements: string;
  guest_category: "guest" | "honorary_guest";
  guest_dining_amount: string;
  dining_waived: boolean;
  gift_aid_consent_status: "unknown" | "declared" | "declined";
  is_member: boolean;
  notes: string;
};

const EMPTY: GuestFormValues = {
  full_name: "",
  email: "",
  phone: "",
  mother_mosque_name: "",
  mother_mosque_number: "",
  constitution: "",
  rank: "",
  dietary_requirements: "",
  guest_category: "guest",
  guest_dining_amount: "",
  dining_waived: false,
  gift_aid_consent_status: "unknown",
  is_member: true,
  notes: "",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  guestId?: string;
  initialValues?: Partial<GuestFormValues>;
  onSaved?: (guestId: string) => void;
};

export function GuestFormDialog({
  open,
  onOpenChange,
  mode,
  guestId,
  initialValues,
  onSaved,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<GuestFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues({ ...EMPTY, ...initialValues });
      setError(null);
    }
  }, [open, initialValues]);

  function update<K extends keyof GuestFormValues>(
    key: K,
    value: GuestFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const url =
        mode === "create" ? "/api/admin/guests" : `/api/admin/guests/${guestId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          guest_dining_amount: values.guest_dining_amount.trim()
            ? Number(values.guest_dining_amount)
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Could not save guest.");
      }
      const id = data?.guest?.id ?? guestId;
      onOpenChange(false);
      if (onSaved && id) onSaved(id);
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add a guest" : "Edit guest"}
          </DialogTitle>
          <DialogDescription>
            Newcomer members or other guests known to the mosque. Email is
            optional, but lets us send them their invitation and receipts.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="full_name">Full name *</Label>
            <Input
              id="full_name"
              value={values.full_name}
              onChange={(event) => update("full_name", event.target.value)}
              placeholder="W. Bro John Smith"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              placeholder="member@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+44 7000 000000"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mother_mosque_name">Mother mosque</Label>
            <Input
              id="mother_mosque_name"
              value={values.mother_mosque_name}
              onChange={(event) =>
                update("mother_mosque_name", event.target.value)
              }
              placeholder="St James's Mosque"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mother_mosque_number">Mosque number</Label>
            <Input
              id="mother_mosque_number"
              value={values.mother_mosque_number}
              onChange={(event) =>
                update("mother_mosque_number", event.target.value)
              }
              placeholder="1234"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="constitution">Constitution</Label>
            <Input
              id="constitution"
              value={values.constitution}
              onChange={(event) => update("constitution", event.target.value)}
              placeholder="UGLE"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rank">Rank</Label>
            <Input
              id="rank"
              value={values.rank}
              onChange={(event) => update("rank", event.target.value)}
              placeholder="W. Bro / PM"
            />
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="dietary_requirements">Dietary requirements & allergies</Label>
            <Input
              id="dietary_requirements"
              value={values.dietary_requirements}
              onChange={(event) =>
                update("dietary_requirements", event.target.value)
              }
              placeholder="Vegetarian, no nuts..."
            />
          </div>

          <div className="sm:col-span-2 space-y-2 rounded-lg border border-slate-200 p-3">
            <Label>Guest type</Label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={values.guest_category === "guest"}
                onChange={() => update("guest_category", "guest")}
              />
              Guest (invited per service)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={values.guest_category === "honorary_guest"}
                onChange={() => update("guest_category", "honorary_guest")}
              />
              Honorary guest (included on every notice)
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guest_dining_amount">Dining fee override (£)</Label>
            <Input
              id="guest_dining_amount"
              type="number"
              step="0.01"
              min="0"
              value={values.guest_dining_amount}
              onChange={(event) => update("guest_dining_amount", event.target.value)}
              placeholder="Mosque default"
            />
          </div>

          <div className="flex items-center gap-2 self-end pb-2">
            <input
              id="dining_waived"
              type="checkbox"
              checked={values.dining_waived}
              onChange={(event) => update("dining_waived", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <Label htmlFor="dining_waived" className="font-normal">
              Dines complimentary
            </Label>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="is_member"
              type="checkbox"
              checked={values.is_member}
              onChange={(event) => update("is_member", event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <Label htmlFor="is_member" className="font-normal">
              Newcomer member (member)
            </Label>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="gift_aid_consent_status">Gift Aid status</Label>
            <select
              id="gift_aid_consent_status"
              value={values.gift_aid_consent_status}
              onChange={(event) =>
                update(
                  "gift_aid_consent_status",
                  event.target.value as GuestFormValues["gift_aid_consent_status"],
                )
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="unknown">Unknown / not asked</option>
              <option value="declared">Declared</option>
              <option value="declined">Gift Aid refused</option>
            </select>
            <p className="text-xs text-dash-muted">
              Use refused when the guest has explicitly asked not to Gift Aid
              their donations.
            </p>
          </div>

          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="notes">Internal notes</Label>
            <Textarea
              id="notes"
              value={values.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={3}
              placeholder="Anything the secretary should remember about this guest."
            />
          </div>

          {error ? (
            <p className="sm:col-span-2 text-sm text-destructive">{error}</p>
          ) : null}

          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting
                ? "Saving..."
                : mode === "create"
                  ? "Add guest"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
