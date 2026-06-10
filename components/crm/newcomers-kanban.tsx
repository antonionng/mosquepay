"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  Inbox,
  Flag,
  UserCheck,
} from "lucide-react";
import { PROMPT_CLASSES } from "@/lib/newcomers/next-action";

const STAGE_ACCENT: Record<string, string> = {
  expression_of_interest: "border-t-blue-500",
  initial_contact: "border-t-cyan-500",
  service_scheduled: "border-t-amber-500",
  proposal_church: "border-t-violet-500",
  approved: "border-t-emerald-500",
  welcomed: "border-t-green-500",
  declined: "border-t-red-500",
  on_hold: "border-t-slate-400",
};

const STAGE_COUNT_BADGE: Record<string, string> = {
  expression_of_interest: "border-blue-200 bg-blue-50 text-blue-900",
  initial_contact: "border-cyan-200 bg-cyan-50 text-cyan-900",
  service_scheduled: "border-amber-200 bg-amber-50 text-amber-900",
  proposal_church: "border-violet-200 bg-violet-50 text-violet-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  welcomed: "border-green-200 bg-green-50 text-green-900",
  declined: "border-red-200 bg-red-50 text-red-900",
  on_hold: "border-slate-200 bg-slate-100 text-slate-800",
};

const ACTIVITY_ICONS: Record<string, typeof FileText> = {
  note: FileText,
  service: Calendar,
  phone_call: Phone,
  email: Mail,
  task: CheckCircle2,
};

type Newcomer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  stage: string;
  source: string | null;
  daysInStage: number;
  daysSinceActivity: number;
  lastActivityType: string | null;
  converted_at: string | null;
  promptLabel: string;
  promptReason: string;
  promptSeverity: "info" | "warn" | "urgent" | "ok";
};

export function NewcomersKanban({
  initialNewcomers,
  stages,
  stageLabels,
}: {
  initialNewcomers: Newcomer[];
  stages: string[];
  stageLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [newcomers, setNewcomers] = useState<Newcomer[]>(initialNewcomers);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const activeNewcomer = activeId
    ? newcomers.find((l) => l.id === activeId) ?? null
    : null;

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over?.id) return;
    const newcomerId = String(active.id);
    let newStage: string | null = null;
    const overId = String(over.id);
    if (stages.includes(overId)) {
      newStage = overId;
    } else {
      const overNewcomer = newcomers.find((l) => l.id === overId);
      if (overNewcomer) newStage = overNewcomer.stage;
    }
    if (!newStage) return;
    const newcomer = newcomers.find((l) => l.id === newcomerId);
    if (!newcomer || newcomer.stage === newStage) return;

    setNewcomers((prev) =>
      prev.map((l) => (l.id === newcomerId ? { ...l, stage: newStage } : l))
    );

    try {
      const res = await fetch(`/api/newcomers/church/${newcomerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) {
        setNewcomers(initialNewcomers);
      }
      router.refresh();
    } catch {
      setNewcomers(initialNewcomers);
      router.refresh();
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  const byStage = stages.map((stage) => ({
    stage,
    label: stageLabels[stage] ?? stage,
    items: newcomers.filter((l) => l.stage === stage),
  }));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-[500px] gap-3 overflow-x-auto pb-1">
        {byStage.map((col) => (
          <DroppableColumn
            key={col.stage}
            id={col.stage}
            label={col.label}
            count={col.items.length}
            accent={STAGE_ACCENT[col.stage]}
            countBadgeClass={STAGE_COUNT_BADGE[col.stage]}
          >
            <SortableContext
              items={col.items.map((l) => l.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {col.items.map((newcomer) => (
                  <KanbanCard
                    key={newcomer.id}
                    newcomer={newcomer}
                    isActive={activeId === newcomer.id}
                  />
                ))}
              </div>
              {col.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-dash-muted">
                  <Inbox className="mb-2 h-6 w-6 text-dash-faint" />
                  <span className="text-xs">No newcomers</span>
                </div>
              )}
            </SortableContext>
          </DroppableColumn>
        ))}
      </div>

      <DragOverlay>
        {activeNewcomer && (
          <div className="w-64 rounded-xl border border-dash-border-strong bg-dash-surface p-3 text-sm shadow-dash-raised ring-2 ring-blue-500/15">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 to-violet-500/15 text-xs font-semibold text-blue-800">
                {activeNewcomer.first_name[0]}
                {activeNewcomer.last_name[0]}
              </div>
              <div className="min-w-0">
                <p className="truncate font-medium text-dash-text">
                  {activeNewcomer.first_name} {activeNewcomer.last_name}
                </p>
                <p className="truncate text-xs text-dash-muted">
                  {activeNewcomer.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DroppableColumn({
  id,
  label,
  count,
  accent,
  countBadgeClass,
  children,
}: {
  id: string;
  label: string;
  count: number;
  accent?: string;
  countBadgeClass?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "w-64 flex-shrink-0 rounded-xl border border-dash-border border-t-2 bg-dash-surface-subtle p-3 shadow-sm transition-all",
        accent ?? "border-t-slate-400",
        isOver && "border-blue-200 bg-blue-50/60 shadow-dash ring-1 ring-blue-200/80"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2 px-0.5">
        <h3 className="truncate text-xs font-semibold text-dash-text">
          {label}
        </h3>
        <Badge
          variant="outline"
          className={cn(
            "h-5 min-w-5 shrink-0 justify-center px-1.5 text-[10px] font-semibold tabular-nums",
            countBadgeClass ?? "border-slate-200 bg-white text-slate-800"
          )}
        >
          {count}
        </Badge>
      </div>
      {children}
    </div>
  );
}

function KanbanCard({
  newcomer,
  isActive,
}: {
  newcomer: Newcomer;
  isActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: newcomer.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const isStale = newcomer.daysSinceActivity >= 14;
  const isWarning = newcomer.daysSinceActivity >= 7 && !isStale;
  const ActivityIcon = newcomer.lastActivityType
    ? ACTIVITY_ICONS[newcomer.lastActivityType] ?? FileText
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-xl border bg-dash-surface p-3 text-sm shadow-sm transition-all active:cursor-grabbing",
        isDragging && "z-50 opacity-50",
        isActive && "ring-2 ring-blue-400/40",
        isStale
          ? "border-red-200 bg-red-50/50"
          : isWarning
          ? "border-amber-200 bg-amber-50/40"
          : "border-dash-border hover:border-dash-border-strong hover:shadow-dash"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/12 to-violet-500/12 text-[10px] font-semibold text-blue-800">
          {newcomer.first_name[0]}
          {newcomer.last_name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/newcomers/church/${newcomer.id}`}
            className="block truncate font-medium text-dash-text transition-colors hover:text-blue-700"
            onClick={(e) => e.stopPropagation()}
          >
            {newcomer.first_name} {newcomer.last_name}
          </Link>
          <p className="truncate text-xs text-dash-muted">{newcomer.email}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-2 text-[10px] text-dash-muted">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span className="tabular-nums">{newcomer.daysInStage}d</span>
        </div>
        {ActivityIcon && (
          <div className="flex items-center gap-1">
            <ActivityIcon className="h-3 w-3" />
          </div>
        )}
        {isStale && (
          <div className="ml-auto flex items-center gap-1 font-medium text-red-700">
            <AlertTriangle className="h-3 w-3" />
            <span>Stale</span>
          </div>
        )}
        {isWarning && (
          <div className="ml-auto flex items-center gap-1 font-medium text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            <span>Cooling</span>
          </div>
        )}
      </div>

      <div
        className={cn(
          "mt-2.5 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-medium",
          PROMPT_CLASSES[newcomer.promptSeverity]
        )}
        title={newcomer.promptReason}
      >
        {newcomer.converted_at ? (
          <UserCheck className="h-3 w-3 shrink-0" />
        ) : (
          <Flag className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">{newcomer.promptLabel}</span>
      </div>
    </div>
  );
}
