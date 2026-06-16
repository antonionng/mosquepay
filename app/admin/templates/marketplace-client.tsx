"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  Mail,
  MailCheck,
  PartyPopper,
  Search,
  Sparkles,
  Wallet,
  HeartHandshake,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type Category =
  | "all"
  | "newsletter"
  | "notice"
  | "giving"
  | "events"
  | "milestones"
  | "pastoral";

type MarketplaceTemplate = {
  template_key: string;
  name: string;
  category: Exclude<Category, "all">;
  description: string;
  subject: string;
  html_body: string;
  merge_tags: readonly string[];
  installed: boolean;
};

const CATEGORY_META: Record<
  Exclude<Category, "all">,
  { label: string; icon: LucideIcon; tone: string }
> = {
  newsletter: { label: "Newsletter", icon: Mail, tone: "bg-blue-100 text-blue-700" },
  notice: { label: "Notice", icon: FileText, tone: "bg-violet-100 text-violet-700" },
  giving: { label: "Giving", icon: Wallet, tone: "bg-amber-100 text-amber-700" },
  events: { label: "Events", icon: MailCheck, tone: "bg-emerald-100 text-emerald-700" },
  milestones: {
    label: "Milestones",
    icon: PartyPopper,
    tone: "bg-pink-100 text-pink-700",
  },
  pastoral: {
    label: "PastoralCare",
    icon: HeartHandshake,
    tone: "bg-rose-100 text-rose-700",
  },
};

export function TemplateMarketplaceClient({
  templates,
}: {
  templates: MarketplaceTemplate[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return templates.filter((tpl) => {
      if (tab !== "all" && tpl.category !== tab) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.subject.toLowerCase().includes(q)
      );
    });
  }, [templates, tab, query]);

  function toggle(key: string) {
    setSelected((prev) => {
      const copy = new Set(prev);
      if (copy.has(key)) copy.delete(key);
      else copy.add(key);
      return copy;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const copy = new Set(prev);
      for (const tpl of filtered) copy.add(tpl.template_key);
      return copy;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function install(keys: string[]) {
    if (keys.length === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/templates/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Install failed.");
      setFeedback(`Installed ${data.installed?.length ?? 0} template(s).`);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Install failed.");
    } finally {
      setBusy(false);
    }
  }

  const preview = previewKey
    ? templates.find((t) => t.template_key === previewKey) ?? null
    : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Templates marketplace
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Communications template library
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Hand-crafted starting points for every email your mosque sends.
            Install one or many; you can edit them freely afterwards under
            Communications &rsaquo; Templates.
          </p>
        </div>
        <Link href="/admin/communications">
          <Button variant="outline">Open communications</Button>
        </Link>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates"
            className="w-64 pl-8"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Filter className="h-3 w-3" /> {filtered.length} of {templates.length}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={selectAllVisible}>
            Select visible
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearSelection}
            disabled={selected.size === 0}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => install(Array.from(selected))}
            disabled={busy || selected.size === 0}
          >
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1 h-4 w-4" />
            )}
            Install {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Category)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {Object.entries(CATEGORY_META).map(([id, meta]) => (
            <TabsTrigger key={id} value={id}>
              {meta.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((tpl) => {
              const meta = CATEGORY_META[tpl.category];
              const Icon = meta.icon;
              const isSelected = selected.has(tpl.template_key);
              return (
                <div
                  key={tpl.template_key}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tone}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {tpl.name}
                        </p>
                        <Badge variant="outline" className="mt-0.5 text-[10px]">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                    {tpl.installed && (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-700"
                      >
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Installed
                      </Badge>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{tpl.description}</p>
                  <p className="mt-2 line-clamp-2 text-xs italic text-slate-400">
                    Subject: {tpl.subject}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tpl.merge_tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600"
                      >
                        {`{{${tag}}}`}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewKey(tpl.template_key)}
                    >
                      <Eye className="mr-1 h-3 w-3" /> Preview
                    </Button>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(tpl.template_key)}
                        />
                        Select
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => install([tpl.template_key])}
                      >
                        {tpl.installed ? "Reinstall" : "Install"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <Sparkles className="h-6 w-6 text-slate-400" aria-hidden />
              <p className="text-sm text-slate-600">
                No templates match your search.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setPreviewKey(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Preview
                </p>
                <h3 id="preview-title" className="text-base font-semibold">
                  {preview.name}
                </h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewKey(null)}>
                Close
              </Button>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <p className="text-xs uppercase text-slate-500">Subject</p>
                <p className="font-medium text-slate-900">{preview.subject}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Body</p>
                <div
                  className="prose prose-sm mt-1 max-h-[50vh] max-w-none overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4"
                  dangerouslySetInnerHTML={{ __html: preview.html_body }}
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={() => install([preview.template_key])} disabled={busy}>
                  {preview.installed ? "Reinstall" : "Install"} this template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
