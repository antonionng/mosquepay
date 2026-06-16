"use client";

import { useMemo, useState } from "react";
import { Copy, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/site-builder/image-upload-field";
import { SimpleSiteBuilder } from "@/components/site-builder/simple-site-builder";
import type {
  MosqueSiteCustomPage,
  MosqueSitePage,
  MosqueSiteSection,
} from "@/lib/db/types";
import { cn } from "@/lib/utils";

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "page"
  );
}

function uniqueSlug(base: string, pages: MosqueSiteCustomPage[], currentId?: string) {
  const stem = slugify(base);
  let next = stem;
  let count = 2;
  while (pages.some((page) => page.slug === next && page.id !== currentId)) {
    next = `${stem}-${count}`;
    count += 1;
  }
  return next;
}

function createBlankPage(pages: MosqueSiteCustomPage[]): MosqueSiteCustomPage {
  const id = crypto.randomUUID();
  const title = "New page";
  return {
    id,
    slug: uniqueSlug(title, pages),
    title,
    description: null,
    seo_title: null,
    seo_description: null,
    social_image_url: null,
    sections: [],
    published: false,
    show_in_nav: true,
    nav_label: title,
    order: pages.length + 1,
  };
}

export function SitePagesManager({
  mosqueSlug,
  site,
  primaryColor,
}: {
  mosqueSlug: string;
  site: MosqueSitePage;
  primaryColor: string;
}) {
  const [pages, setPages] = useState<MosqueSiteCustomPage[]>(site.custom_pages ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(pages[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const orderedPages = useMemo(
    () =>
      pages
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((page, index) => ({ ...page, order: index + 1 })),
    [pages]
  );
  const selectedPage = orderedPages.find((page) => page.id === selectedId) ?? null;

  async function savePages(nextPages = orderedPages) {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/mosques/${mosqueSlug}/site`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom_pages: nextPages }),
      });
      if (!response.ok) throw new Error("Could not save pages.");
      setMessage("Pages saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save pages.");
      throw error;
    } finally {
      setSaving(false);
    }
  }

  function updatePage(id: string, patch: Partial<MosqueSiteCustomPage>) {
    setPages((current) =>
      current.map((page) => (page.id === id ? { ...page, ...patch } : page))
    );
  }

  function addPage() {
    const page = createBlankPage(orderedPages);
    setPages((current) => [...current, page]);
    setSelectedId(page.id);
  }

  function duplicatePage(page: MosqueSiteCustomPage) {
    const copyPage: MosqueSiteCustomPage = {
      ...page,
      id: crypto.randomUUID(),
      title: `${page.title} copy`,
      slug: uniqueSlug(`${page.slug}-copy`, orderedPages),
      published: false,
      order: orderedPages.length + 1,
    };
    setPages((current) => [...current, copyPage]);
    setSelectedId(copyPage.id);
  }

  function deletePage(id: string) {
    const next = orderedPages.filter((page) => page.id !== id);
    setPages(next);
    setSelectedId(next[0]?.id ?? null);
  }

  async function saveBuilderPage(payload: {
    page_title: string;
    page_description: string | null;
    sections: MosqueSiteSection[];
    published?: boolean;
  }) {
    if (!selectedPage) return;
    const next = orderedPages.map((page) =>
      page.id === selectedPage.id
        ? {
            ...page,
            title: payload.page_title,
            description: payload.page_description,
            sections: payload.sections,
            published: payload.published ?? page.published,
          }
        : page
    );
    setPages(next);
    await savePages(next);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      <aside className="admin-surface p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-dash-text">Pages</h2>
            <p className="mt-1 text-sm text-dash-muted">
              Create extra public pages and control the mosque navigation.
            </p>
          </div>
          <Button type="button" size="sm" variant="primary" onClick={addPage}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="mt-5 space-y-2">
          {orderedPages.length === 0 ? (
            <div className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4 text-sm text-dash-muted">
              Add a page to start building an About, Join, Visit, or campaign page.
            </div>
          ) : null}
          {orderedPages.map((page) => (
            <button
              key={page.id}
              type="button"
              onClick={() => setSelectedId(page.id)}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition",
                selectedPage?.id === page.id
                  ? "border-dash-ring bg-dash-ring/10"
                  : "border-dash-border bg-dash-surface-subtle hover:border-dash-border-strong"
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-dash-text">{page.title}</p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    page.published
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-amber-50 text-amber-800"
                  )}
                >
                  {page.published ? "Live" : "Draft"}
                </span>
              </div>
              <p className="mt-2 text-xs text-dash-muted">
                {page.show_in_nav ? "Shown in navigation" : "Hidden from navigation"}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button type="button" onClick={() => savePages()} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save pages
          </Button>
          {message ? <span className="text-sm text-dash-muted">{message}</span> : null}
        </div>
      </aside>

      <main className="space-y-6">
        {selectedPage ? (
          <>
            <section className="admin-surface p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-dash-text">Page details</h2>
                  <p className="mt-1 text-sm text-dash-muted">
                    Name the page, choose whether it is live, and decide if it appears in the menu.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => duplicatePage(selectedPage)}>
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => deletePage(selectedPage.id)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-dash-muted">Page title</label>
                  <Input
                    value={selectedPage.title}
                    onChange={(event) => {
                      const title = event.target.value;
                      updatePage(selectedPage.id, {
                        title,
                        nav_label: selectedPage.nav_label || title,
                      });
                    }}
                  />
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-xs font-medium text-dash-muted">Description</label>
                  <Textarea
                    value={selectedPage.description ?? ""}
                    onChange={(event) =>
                      updatePage(selectedPage.id, {
                        description: event.target.value || null,
                      })
                    }
                    rows={3}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-dash-muted">Menu label</label>
                  <Input
                    value={selectedPage.nav_label ?? ""}
                    onChange={(event) =>
                      updatePage(selectedPage.id, {
                        nav_label: event.target.value || null,
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle px-3 py-2 text-sm text-dash-text">
                    <input
                      type="checkbox"
                      checked={selectedPage.show_in_nav}
                      onChange={(event) =>
                        updatePage(selectedPage.id, { show_in_nav: event.target.checked })
                      }
                    />
                    Show in menu
                  </label>
                  <label className="flex items-center gap-2 rounded-xl border border-dash-border bg-dash-surface-subtle px-3 py-2 text-sm text-dash-text">
                    <input
                      type="checkbox"
                      checked={selectedPage.published}
                      onChange={(event) =>
                        updatePage(selectedPage.id, { published: event.target.checked })
                      }
                    />
                    Make page live
                  </label>
                </div>
                <details className="rounded-2xl border border-dash-border bg-dash-surface-subtle p-4 lg:col-span-2">
                  <summary className="cursor-pointer text-sm font-semibold text-dash-text">
                    Advanced page settings
                  </summary>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-dash-muted">Web address</label>
                      <div className="flex rounded-lg border border-dash-border bg-dash-surface">
                        <span className="flex items-center border-r border-dash-border px-3 text-sm text-dash-muted">
                          /site/
                        </span>
                        <Input
                          value={selectedPage.slug}
                          onChange={(event) =>
                            updatePage(selectedPage.id, {
                              slug: uniqueSlug(event.target.value, orderedPages, selectedPage.id),
                            })
                          }
                          className="border-0 bg-transparent"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-dash-muted">Search result title</label>
                      <Input
                        value={selectedPage.seo_title ?? ""}
                        onChange={(event) =>
                          updatePage(selectedPage.id, { seo_title: event.target.value || null })
                        }
                      />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <label className="text-xs font-medium text-dash-muted">
                        Search result description
                      </label>
                      <Input
                        value={selectedPage.seo_description ?? ""}
                        onChange={(event) =>
                          updatePage(selectedPage.id, {
                            seo_description: event.target.value || null,
                          })
                        }
                      />
                    </div>
                  </div>
                </details>
                <div className="lg:col-span-2">
                  <ImageUploadField
                    label="Social image"
                    value={selectedPage.social_image_url ?? ""}
                    onChange={(value) =>
                      updatePage(selectedPage.id, { social_image_url: value || null })
                    }
                  />
                </div>
              </div>
            </section>

            <section className="admin-surface overflow-hidden p-6">
              <SimpleSiteBuilder
                key={selectedPage.id}
                mosqueSlug={mosqueSlug}
                initialSections={selectedPage.sections}
                pageTitle={selectedPage.title}
                pageDescription={selectedPage.description}
                primaryColor={primaryColor}
                initiallyPublished={selectedPage.published}
                publicHref={`/site/${selectedPage.slug}?mosque=${encodeURIComponent(mosqueSlug)}`}
                title={`${selectedPage.title} builder`}
                description="Build this custom page with the same templates, media, forms, and section controls."
                onPersist={saveBuilderPage}
              />
            </section>
          </>
        ) : (
          <section className="admin-surface p-10 text-center">
            <h2 className="text-xl font-semibold text-dash-text">No custom pages yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-dash-muted">
              Add pages for About, Join, Visit, campaigns, or anything the mosque wants in its public navigation.
            </p>
            <Button type="button" className="mt-5" variant="primary" onClick={addPage}>
              <Plus className="mr-2 h-4 w-4" />
              Add first page
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
