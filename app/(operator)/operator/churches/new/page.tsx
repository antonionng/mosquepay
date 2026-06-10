"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Palette,
  Sparkles,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from "lucide-react";

const STEPS = [
  { label: "Church Details", icon: Building2 },
  { label: "Branding", icon: Palette },
  { label: "AI Website", icon: Sparkles },
  { label: "Review & Create", icon: CheckCircle2 },
];

type FormData = {
  name: string;
  slug: string;
  city: string;
  country: string;
  tagline: string;
  support_email: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string;
  ai_brief: string;
  ai_tone: string;
  ai_audience: string;
};

const initial: FormData = {
  name: "",
  slug: "",
  city: "",
  country: "England",
  tagline: "",
  support_email: "",
  primary_color: "#1e3a5f",
  secondary_color: "#d4af37",
  logo_url: "",
  ai_brief: "",
  ai_tone: "Warm and welcoming",
  ai_audience: "Prospective church member newcomers",
};

export default function ChurchOnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof FormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name" && !prev.slug) {
        next.slug = value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      }
      return next;
    });
  }

  function canProceed() {
    if (step === 0) return form.name.trim().length > 0;
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const churchRes = await fetch("/api/churches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || undefined,
          city: form.city || undefined,
          country: form.country || undefined,
          tagline: form.tagline || undefined,
          support_email: form.support_email || undefined,
          primary_color: form.primary_color || undefined,
          secondary_color: form.secondary_color || undefined,
          logo_url: form.logo_url || undefined,
        }),
      });
      if (!churchRes.ok) {
        const body = await churchRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create church");
      }
      const { church } = await churchRes.json();

      if (form.ai_brief.trim()) {
        await fetch(`/api/churches/${church.slug}/ai-draft`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: form.ai_brief,
            tone: form.ai_tone,
            audience: form.ai_audience,
          }),
        }).catch(() => {});
      }

      router.push(`/operator/churches/${church.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50";

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Onboard New Church</h1>
          <p className="admin-page-copy">
            Set up a new church on the platform
          </p>
        </div>
      </div>

      <div className="admin-surface p-1">
        <div className="flex border-b border-white/10">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => i <= step && setStep(i)}
                className={`flex flex-1 items-center justify-center gap-2 px-3 py-3.5 text-xs font-medium transition-colors sm:text-sm ${
                  i === step
                    ? "border-b-2 border-blue-500 text-white"
                    : i < step
                      ? "text-blue-400 hover:text-blue-300"
                      : "text-slate-600"
                }`}
              >
                <Icon className="h-4 w-4 hidden sm:block" />
                <span className="hidden xs:inline">{s.label}</span>
                <span className="xs:hidden">
                  {i + 1}. {s.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-6 min-h-[360px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {step === 0 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Church Name *
                    </label>
                    <input
                      className={inputCls}
                      placeholder="e.g. St Mary's Church"
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Slug
                    </label>
                    <input
                      className={inputCls}
                      placeholder="auto-generated from name"
                      value={form.slug}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, slug: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      City
                    </label>
                    <input
                      className={inputCls}
                      placeholder="London"
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Country
                    </label>
                    <input
                      className={inputCls}
                      placeholder="England"
                      value={form.country}
                      onChange={(e) => update("country", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Tagline
                    </label>
                    <input
                      className={inputCls}
                      placeholder="A short description"
                      value={form.tagline}
                      onChange={(e) => update("tagline", e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Support Email
                    </label>
                    <input
                      type="email"
                      className={inputCls}
                      placeholder="secretary@church.com"
                      value={form.support_email}
                      onChange={(e) => update("support_email", e.target.value)}
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Primary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form.primary_color}
                        onChange={(e) => update("primary_color", e.target.value)}
                        className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                      />
                      <input
                        className={inputCls}
                        value={form.primary_color}
                        onChange={(e) => update("primary_color", e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Secondary Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) =>
                          update("secondary_color", e.target.value)
                        }
                        className="h-10 w-14 cursor-pointer rounded-lg border border-white/10 bg-transparent"
                      />
                      <input
                        className={inputCls}
                        value={form.secondary_color}
                        onChange={(e) =>
                          update("secondary_color", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Logo URL
                    </label>
                    <input
                      className={inputCls}
                      placeholder="https://example.com/logo.png (or leave blank)"
                      value={form.logo_url}
                      onChange={(e) => update("logo_url", e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      File upload coming soon. Paste a URL for now
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-sm text-slate-400">Preview</p>
                    <div className="mt-3 flex items-center gap-4">
                      <div
                        className="h-16 w-16 rounded-2xl"
                        style={{ backgroundColor: form.primary_color }}
                      />
                      <div
                        className="h-16 w-16 rounded-2xl"
                        style={{ backgroundColor: form.secondary_color }}
                      />
                      <div
                        className="h-16 flex-1 rounded-2xl border border-white/10"
                        style={{
                          background: `linear-gradient(135deg, ${form.primary_color}, ${form.secondary_color})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-5">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-300">
                      Brief
                    </label>
                    <textarea
                      className={`${inputCls} min-h-[100px] resize-y`}
                      placeholder="Describe the church, its history, and what makes it special…"
                      value={form.ai_brief}
                      onChange={(e) => update("ai_brief", e.target.value)}
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                      The AI will generate a first-draft website from this brief
                    </p>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        Tone
                      </label>
                      <select
                        className={inputCls}
                        value={form.ai_tone}
                        onChange={(e) => update("ai_tone", e.target.value)}
                      >
                        <option value="Warm and welcoming">
                          Warm and welcoming
                        </option>
                        <option value="Formal and traditional">
                          Formal and traditional
                        </option>
                        <option value="Modern and approachable">
                          Modern and approachable
                        </option>
                        <option value="Professional and concise">
                          Professional and concise
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-300">
                        Target Audience
                      </label>
                      <select
                        className={inputCls}
                        value={form.ai_audience}
                        onChange={(e) => update("ai_audience", e.target.value)}
                      >
                        <option value="Prospective church member newcomers">
                          Prospective newcomers
                        </option>
                        <option value="Existing members">
                          Existing members
                        </option>
                        <option value="General public">General public</option>
                        <option value="Church newcomers and guests">
                          Newcomers and guests
                        </option>
                      </select>
                    </div>
                  </div>
                  {!form.ai_brief.trim() && (
                    <p className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                      You can skip the AI website step. The church will be
                      created without a site draft.
                    </p>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white">
                    Review Church Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["Name", form.name],
                      ["Slug", form.slug || "(auto)"],
                      ["City", form.city || "Not recorded"],
                      ["Country", form.country || "Not recorded"],
                      ["Tagline", form.tagline || "Not recorded"],
                      ["Support Email", form.support_email || "Not recorded"],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-xs font-medium text-slate-500">
                          {label}
                        </p>
                        <p className="mt-0.5 text-sm text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      Brand Colors
                    </p>
                    <div className="mt-2 flex gap-3">
                      <div
                        className="h-8 w-8 rounded-lg"
                        style={{ backgroundColor: form.primary_color }}
                      />
                      <div
                        className="h-8 w-8 rounded-lg"
                        style={{ backgroundColor: form.secondary_color }}
                      />
                    </div>
                  </div>
                  {form.ai_brief.trim() && (
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        AI Website Brief
                      </p>
                      <p className="mt-0.5 text-sm text-slate-300 line-clamp-3">
                        {form.ai_brief}
                      </p>
                    </div>
                  )}
                  {error && (
                    <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-300">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-6 py-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !form.name.trim()}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Create Church
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
