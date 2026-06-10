"use client";

import { useState } from "react";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import {
  FileText,
  Calendar,
  Phone,
  Mail,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  Users,
} from "lucide-react";

export type TimelineItem = {
  year: string;
  title: string;
  description: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative">
      <div className="absolute bottom-0 left-3 top-0 w-px bg-slate-200 lg:left-1/2" />

      <div className="space-y-12">
        {items.map((item, i) => (
          <div
            key={item.year}
            className={cn(
              "relative flex items-start gap-8 lg:gap-12",
              i % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
            )}
          >
            <div className="absolute left-0 lg:left-1/2 lg:-translate-x-1/2 z-10">
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-blue-500 bg-white shadow-sm">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              </div>
            </div>

            <div
              className={cn(
                "ml-12 lg:ml-0 lg:w-[calc(50%-40px)]",
                i % 2 === 0
                  ? "lg:text-right lg:pr-8"
                  : "lg:text-left lg:pl-8"
              )}
            >
              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6 shadow-card">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
                  {item.year}
                </span>
                <h3 className="font-semibold text-slate-900 mt-1 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>

            <div className="hidden lg:block lg:w-[calc(50%-40px)]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const ACTIVITY_CONFIG: Record<
  string,
  {
    icon: typeof FileText;
    color: string;
    dotColor: string;
    lineColor: string;
    label: string;
  }
> = {
  note: {
    icon: FileText,
    color: "text-blue-700",
    dotColor: "bg-blue-500 shadow-sm shadow-blue-500/25",
    lineColor: "bg-blue-100",
    label: "Note",
  },
  service: {
    icon: Calendar,
    color: "text-amber-800",
    dotColor: "bg-amber-500 shadow-sm shadow-amber-500/25",
    lineColor: "bg-amber-100",
    label: "Service",
  },
  phone_call: {
    icon: Phone,
    color: "text-emerald-800",
    dotColor: "bg-emerald-500 shadow-sm shadow-emerald-500/25",
    lineColor: "bg-emerald-100",
    label: "Phone Call",
  },
  email: {
    icon: Mail,
    color: "text-cyan-800",
    dotColor: "bg-cyan-500 shadow-sm shadow-cyan-500/25",
    lineColor: "bg-cyan-100",
    label: "Email",
  },
  task: {
    icon: CheckSquare,
    color: "text-violet-800",
    dotColor: "bg-violet-500 shadow-sm shadow-violet-500/25",
    lineColor: "bg-violet-100",
    label: "Task",
  },
};

export type ActivityTimelineItem = {
  id: string;
  type: "note" | "service" | "phone_call" | "email" | "task";
  title: string;
  description?: string;
  date: string;
  serviceDate?: string;
  dueDate?: string;
  completed?: boolean;
  createdBy?: string;
  attendees?: string[];
};
const RELATIVE_TIME_NOW = Date.now();

export function ActivityTimeline({
  items,
}: {
  items: ActivityTimelineItem[];
}) {
  return (
    <div className="relative">
      <div className="absolute bottom-2 left-[11px] top-2 w-px bg-[hsl(var(--dash-border))]" />
      <div className="space-y-0">
        {items.map((item) => (
          <ActivityTimelineEntry key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function ActivityTimelineEntry({
  item,
}: {
  item: ActivityTimelineItem;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTIVITY_CONFIG[item.type] ?? ACTIVITY_CONFIG.note;
  const Icon = config.icon;
  const hasDetails =
    item.description || item.serviceDate || item.dueDate || item.attendees?.length;

  function relativeTime(dateStr: string): string {
    const diff = RELATIVE_TIME_NOW - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return formatDate(dateStr);
  }

  return (
    <div className="relative flex gap-4 pb-6 last:pb-0 group">
      <div className="relative flex flex-col items-center">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-sm",
            config.dotColor
          )}
        >
          <Icon className="h-3 w-3 text-white" />
        </div>
      </div>

      <div className="flex-1 min-w-0 -mt-0.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wider",
                  config.color
                )}
              >
                {config.label}
              </span>
              {item.completed === false && item.type === "task" && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  Pending
                </span>
              )}
              {item.completed === true && item.type === "task" && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                  Done
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-slate-900">
              {item.title}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-slate-500">
              {relativeTime(item.date)}
            </span>
            {hasDetails && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-slate-400 transition-colors hover:text-slate-700"
              >
                {expanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {item.createdBy && (
          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
            <User className="h-3 w-3" />
            {item.createdBy}
          </div>
        )}

        {expanded && hasDetails && (
          <div className="mt-3 space-y-2 rounded-lg border border-dash-border bg-dash-surface-subtle p-3">
            {item.description && (
              <p className="text-sm leading-relaxed text-slate-600">
                {item.description}
              </p>
            )}
            {item.serviceDate && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Calendar className="h-3 w-3" />
                Service: {formatDateTime(item.serviceDate)}
              </div>
            )}
            {item.dueDate && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Clock className="h-3 w-3" />
                Due: {formatDate(item.dueDate)}
              </div>
            )}
            {item.attendees && item.attendees.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Users className="h-3 w-3" />
                {item.attendees.join(", ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
