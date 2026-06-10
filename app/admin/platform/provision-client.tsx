"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Network = { id: string; name: string };

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ProvisionChurchClient({ networks }: { networks: Network[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    church_number: "",
    city: "",
    secretary_name: "",
    secretary_email: "",
    network_id: "",
    send_invite: false,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "name" &&
      typeof value === "string" &&
      !prev.slug.trim()
        ? { slug: slugify(value) }
        : {}),
    }));
  }

  async function submit() {
    if (!form.name.trim()) {
      setFeedback("Church name is required.");
      return;
    }
    setBusy(true);
    try {
      const requestedInvite = form.send_invite;
      const res = await fetch("/api/admin/platform/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || slugify(form.name),
          church_number: form.church_number.trim() || null,
          city: form.city.trim() || null,
          secretary_name: form.secretary_name.trim() || null,
          secretary_email: form.secretary_email.trim() || null,
          network_id: form.network_id || null,
          send_invite: form.send_invite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create church.");
      let feedbackMessage = "Church created.";
      if (form.secretary_email && requestedInvite) {
        feedbackMessage = data.invite?.sent
          ? `Church created. Invite sent to ${form.secretary_email}.`
          : `Church created. Invite failed: ${data.invite?.error ?? "unknown error"}`;
      } else if (form.secretary_email) {
        feedbackMessage = `Church created with secretary ${form.secretary_email}. Send the invite from the church admin when ready.`;
      } else {
        feedbackMessage = "Church created. Add officers from the church admin.";
      }
      setFeedback(feedbackMessage);
      setForm({
        name: "",
        slug: "",
        church_number: "",
        city: "",
        secretary_name: "",
        secretary_email: "",
        network_id: "",
        send_invite: false,
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
        <Plus className="mr-2 h-4 w-4" /> Provision church
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Provision a new church
          </h2>
          <p className="text-xs text-slate-500">
            Creates the tenant, optionally links it to a network, and emails
            the secretary an invite to set up their admin account.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="prov-name">Church name</Label>
          <Input
            id="prov-name"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="St George's Church No 1234"
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
          <Label htmlFor="prov-num">Church number</Label>
          <Input
            id="prov-num"
            value={form.church_number}
            onChange={(e) => update("church_number", e.target.value)}
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
          <Label htmlFor="prov-network">Network (optional)</Label>
          <select
            id="prov-network"
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={form.network_id}
            onChange={(e) => update("network_id", e.target.value)}
          >
            <option value="">Unassigned</option>
            {networks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        {form.secretary_email.trim() ? (
          <label className="md:col-span-2 flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              checked={form.send_invite}
              onChange={(e) => update("send_invite", e.target.checked)}
            />
            <span>
              Email the secretary an invite link now
              <span className="ml-2 text-slate-500">
                (otherwise the record is created without sending an email)
              </span>
            </span>
          </label>
        ) : null}
      </div>

      {feedback && (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          {feedback}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Create church
        </Button>
      </div>
    </div>
  );
}
