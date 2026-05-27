import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, cn } from "@/lib/utils";
import { DASH_TABLE } from "@/lib/admin-dash-table";
import * as db from "@/lib/db";
import * as mockDb from "@/lib/mock-db";
import { getAdminReadContext } from "@/lib/admin/read-context";
import { Plus, FileText, CheckCircle2, FileEdit } from "lucide-react";

type KpiAccent = "blue" | "violet" | "emerald";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  violet: { wrap: "bg-violet-500/10", icon: "text-violet-600" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
};

export default async function AdminBlogPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const rawPosts = useMock
    ? mockDb.getBlogPosts()
    : lodgeId
      ? await db.getBlogPosts(lodgeId)
      : [];
  const posts = rawPosts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    published: p.published,
    published_at: p.published_at,
  }));

  const publishedCount = posts.filter((p) => p.published).length;
  const draftCount = posts.length - publishedCount;

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof FileText;
    accent: KpiAccent;
  }> = [
    {
      label: "Total posts",
      value: String(posts.length),
      hint: "News & announcements",
      icon: FileText,
      accent: "blue",
    },
    {
      label: "Published",
      value: String(publishedCount),
      hint: "Visible on public site",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Drafts",
      value: String(draftCount),
      hint: "Work in progress",
      icon: FileEdit,
      accent: "violet",
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Blog</h1>
          <p className="admin-page-copy">News posts and announcements for the public site.</p>
        </div>
        <Button asChild size="sm" variant="primary">
          <Link href="/admin/blog/new">
            <Plus className="mr-2 h-4 w-4" />
            New
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          const ac = kpiAccentIcon[k.accent];
          return (
            <Card
              key={k.label}
              variant="kpi"
              className="dash-kpi-card h-full rounded-xl p-5 hover:border-dash-border-strong"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-[0.12em] text-dash-muted [.dash-kpi-card_&]:text-dash-muted">
                    {k.label}
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-dash-text [.dash-kpi-card_&]:text-dash-text">
                    {k.value}
                  </p>
                  <p className="mt-2 text-xs text-dash-muted">{k.hint}</p>
                </div>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                    ac.wrap
                  )}
                >
                  <Icon className={cn("h-5 w-5", ac.icon)} aria-hidden />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="dash-filter-bar flex flex-wrap items-center gap-2 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-dash-muted">
          Content
        </span>
        <Badge variant="secondary">
          {posts.length} posts
        </Badge>
        <Badge variant="secondary">
          {publishedCount} live
        </Badge>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">All posts</h2>
            <p className="dash-panel-header-description">
              Slugs appear in URLs; publish when ready for the lodge site.
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="admin-empty bg-dash-surface text-dash-text-muted">No posts yet.</div>
        ) : (
          <Table className={DASH_TABLE.table}>
            <TableHeader className={DASH_TABLE.header}>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={DASH_TABLE.head}>Title</TableHead>
                <TableHead className={DASH_TABLE.head}>Slug</TableHead>
                <TableHead className={DASH_TABLE.head}>Status</TableHead>
                <TableHead className={DASH_TABLE.head}>Date</TableHead>
                <TableHead className={cn(DASH_TABLE.head, "w-[100px]")} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id} className={DASH_TABLE.row}>
                  <TableCell className={cn(DASH_TABLE.cell, "font-medium")}>{p.title}</TableCell>
                  <TableCell className={DASH_TABLE.cellMuted}>{p.slug}</TableCell>
                  <TableCell className={DASH_TABLE.cell}>
                    {p.published ? (
                      <Badge variant="outline" className="border-dash-border bg-dash-surface-subtle text-emerald-700">
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="text-dash-text-muted">
                        Draft
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={DASH_TABLE.cellMuted}>
                    {p.published_at ? formatDate(p.published_at) : "Not recorded"}
                  </TableCell>
                  <TableCell className={DASH_TABLE.cell}>
                    <Button asChild variant="ghost" size="sm" className="text-dash-ring hover:text-dash-text">
                      <Link href={`/admin/blog/${p.id}`}>Edit</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
