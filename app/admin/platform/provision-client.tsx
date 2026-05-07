"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Province = { id: string; name: string };

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ProvisionLodgeClient({ provinces }: { provinces: Province[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    lodge_number: "",
    city: "",
    secretary_name: "",
    secretary_email: "",
    province_id: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "name" && !prev.slug.trim()
        ? { slug: slugify(value) }
        : {}),
    }));
  }

  async function submit() {
    if (!form.name.trim()) {
      setFeedback("Lodge name is required.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/platform/lodges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || slugify(form.name),
          lodge_number: form.lodge_number.trim() || null,
          city: form.city.trim() || null,
          secretary_name: form.secretary_name.trim() || null,
          secretary_email: form.secretary_email.trim() || null,
          province_id: form.province_id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create lodge.");
      setFeedback(
        data.invite?.sent
          ? `Lodge created. Invite sent to ${form.secretary_email}.`
          : `Lodge created. ${data.invite?.error ? `Invite failed: ${data.invite.error}` : "Add officers from the lodge admin."}`
      );
      setForm({
        name: "",
        slug: "",
        lodge_number: "",
        city: "",
        secretary_name: "",
        secretary_email: "",
        province_id: "",
      });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" /> Provision lodge
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Provision a new lodge
          </h2>
          <p className="text-xs text-slate-500">
            Creates the tenant, optionally links it to a province, and emails
            the secretary an invite to set up their admin account.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="prov-name">Lodge name</Label>
          <Input
            id="prov-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="St George's Lodge No 1234"
          />
        </div>
        <div>
          <Label htmlFor="prov-slug">URL slug</Label>
          <Input
            id="prov-slug"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value)}
            placeholder="st-georges-1234"
          />
        </div>
        <div>
          <Label htmlFor="prov-num">Lodge number</Label>
          <Input
            id="prov-num"
            value={form.lodge_number}
            onChange={(e) => update("lodge_number", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="prov-city">City</Label>
          <Input
            id="prov-city"
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="prov-secname">Secretary name</Label>
          <Input
            id="prov-secname"
            value={form.secretary_name}
            onChange={(e) => update("secretary_name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="prov-secemail">Secretary email</Label>
          <Input
            id="prov-secemail"
            type="email"
            value={form.secretary_email}
            onChange={(e) => update("secretary_email", e.target.value)}
            placeholder="secretary@example.com"
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="prov-province">Province (optional)</Label>
          <select
            id="prov-province"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.province_id}
            onChange={(e) => update("province_id", e.target.value)}
          >
            <option value="">Unassigned</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {feedback && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Create lodge
        </Button>
      </div>
    </div>
  );
}
