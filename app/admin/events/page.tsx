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
import { Plus, Calendar, Users, FileEdit, CheckCircle2 } from "lucide-react";

type KpiAccent = "blue" | "violet" | "emerald" | "amber";

const kpiAccentIcon: Record<KpiAccent, { wrap: string; icon: string }> = {
  blue: { wrap: "bg-blue-500/10", icon: "text-blue-600" },
  violet: { wrap: "bg-violet-500/10", icon: "text-violet-600" },
  emerald: { wrap: "bg-emerald-500/10", icon: "text-emerald-600" },
  amber: { wrap: "bg-amber-500/10", icon: "text-amber-700" },
};

export default async function AdminEventsPage() {
  const ctx = await getAdminReadContext();
  const useMock = ctx.mode === "mock";
  const lodgeId = ctx.mode === "database" ? ctx.lodgeId : null;
  const rawEvents = useMock
    ? mockDb.getEvents()
    : lodgeId
      ? await db.getEvents(lodgeId)
      : [];

  const eventIds = rawEvents.map((e) => e.id);
  const rsvpCounts: Record<string, number> = {};
  for (const eid of eventIds) {
    const rsvps = useMock
      ? mockDb.getRsvpsByEventId(eid)
      : lodgeId
        ? await db.getRsvpsByEventId(eid, lodgeId)
        : [];
    rsvpCounts[eid] = rsvps.length;
  }

  const events = rawEvents.map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    event_date: e.event_date,
    event_type: e.event_type,
    published: e.published,
    rsvp_deadline: e.rsvp_deadline as string | null,
    max_attendees: (e.max_attendees as number | null) ?? null,
    rsvp_count: rsvpCounts[e.id] ?? 0,
  }));

  const now = new Date();
  const publishedCount = events.filter((e) => e.published).length;
  const draftCount = events.length - publishedCount;
  const totalRsvps = events.reduce((s, e) => s + e.rsvp_count, 0);

  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    icon: typeof Calendar;
    accent: KpiAccent;
  }> = [
    {
      label: "Total events",
      value: String(events.length),
      hint: "In this lodge",
      icon: Calendar,
      accent: "blue",
    },
    {
      label: "Published",
      value: String(publishedCount),
      hint: "Live on site & channels",
      icon: CheckCircle2,
      accent: "emerald",
    },
    {
      label: "Drafts",
      value: String(draftCount),
      hint: "Not yet public",
      icon: FileEdit,
      accent: "amber",
    },
    {
      label: "RSVPs",
      value: String(totalRsvps),
      hint: "Across all events",
      icon: Users,
      accent: "violet",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="admin-page-head">
        <div>
          <h1 className="admin-page-title">Events</h1>
          <p className="admin-page-copy">Manage lodge events and publication status.</p>
        </div>
        <Button asChild size="sm" variant="primary">
          <Link href="/admin/events/new">
            <Plus className="mr-2 h-4 w-4" />
            New
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
          Overview
        </span>
        <Badge variant="secondary">
          {events.length} total
        </Badge>
        <Badge variant="secondary">
          {publishedCount} published
        </Badge>
        <Badge variant="secondary">
          {totalRsvps} RSVPs
        </Badge>
      </div>

      <Card variant="panel" className="overflow-hidden p-0">
        <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
          <div>
            <h2 className="dash-panel-header-title">All events</h2>
            <p className="dash-panel-header-description">
              Edit an event to change dates, RSVP limits, and publication.
            </p>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="admin-empty bg-dash-surface text-dash-text-muted">No events yet.</div>
        ) : (
          <Table className={DASH_TABLE.table}>
            <TableHeader className={DASH_TABLE.header}>
              <TableRow className="border-0 hover:bg-transparent">
                <TableHead className={DASH_TABLE.head}>Title</TableHead>
                <TableHead className={DASH_TABLE.head}>ID</TableHead>
                <TableHead className={DASH_TABLE.head}>Date</TableHead>
                <TableHead className={DASH_TABLE.head}>Type</TableHead>
                <TableHead className={DASH_TABLE.head}>RSVPs</TableHead>
                <TableHead className={DASH_TABLE.head}>Deadline</TableHead>
                <TableHead className={DASH_TABLE.head}>Status</TableHead>
                <TableHead className={cn(DASH_TABLE.head, "w-[100px]")} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const deadlineExpired = e.rsvp_deadline
                  ? new Date(e.rsvp_deadline) < now
                  : false;
                const atCapacity =
                  e.max_attendees !== null && e.rsvp_count >= e.max_attendees;

                return (
                  <TableRow key={e.id} className={DASH_TABLE.row}>
                    <TableCell className={cn(DASH_TABLE.cell, "font-medium")}>
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="text-dash-text transition-colors hover:text-dash-ring"
                      >
                        {e.title}
                      </Link>
                    </TableCell>
                    <TableCell className={DASH_TABLE.cellMuted}>
                      <Link
                        href={`/admin/events/${e.id}`}
                        className="font-mono text-xs tracking-tight text-dash-text-faint transition-colors hover:text-dash-ring"
                        title={e.id}
                      >
                        {e.id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className={DASH_TABLE.cellMuted}>
                      {formatDate(e.event_date)}
                    </TableCell>
                    <TableCell className={cn(DASH_TABLE.cellMuted, "capitalize")}>
                      {e.event_type.replace(/_/g, " ")}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-dash-text-muted">
                          <Users className="h-3.5 w-3.5 text-dash-text-faint" />
                          {e.rsvp_count}
                          {e.max_attendees !== null ? ` / ${e.max_attendees}` : ""}
                        </span>
                        {atCapacity && (
                          <Badge variant="warning" className="text-[10px] uppercase">
                            Full
                          </Badge>
                        )}
                      </div>
                      {e.max_attendees !== null && (
                        <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-dash-border">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              atCapacity ? "bg-amber-500" : "bg-dash-ring"
                            )}
                            style={{
                              width: `${Math.min(100, Math.round((e.rsvp_count / e.max_attendees) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      {e.rsvp_deadline ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={
                              deadlineExpired
                                ? "text-dash-text-faint line-through"
                                : "text-dash-text-muted"
                            }
                          >
                            {formatDate(e.rsvp_deadline)}
                          </span>
                          {deadlineExpired && (
                            <Badge variant="destructive" className="text-[10px] uppercase">
                              Expired
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-dash-text-faint">—</span>
                      )}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      {e.published ? (
                        <Badge variant="outline" className="border-dash-border bg-dash-surface-subtle text-emerald-700">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="muted" className="text-dash-text-muted">
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={DASH_TABLE.cell}>
                      <Button asChild variant="ghost" size="sm" className="text-dash-ring hover:text-dash-text">
                        <Link href={`/admin/events/${e.id}`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
