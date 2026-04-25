"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightCircle,
  FileText,
  Calendar,
  Mail,
  Phone,
} from "lucide-react";

export function LeadDetailActions({
  leadId,
  currentStage,
  stageLabels,
  stages,
}: {
  leadId: string;
  currentStage: string;
  stageLabels: Record<string, string>;
  stages: string[];
}) {
  const [newStage, setNewStage] = useState("");
  const [changing, setChanging] = useState(false);

  async function handleStageChange() {
    if (!newStage || newStage === currentStage) return;
    setChanging(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      window.location.reload();
    } catch {
      setChanging(false);
    }
  }

  const quickLinks = [
    {
      label: "Add Note",
      icon: FileText,
      action: () =>
        document
          .getElementById("activity-form")
          ?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      label: "Schedule Meeting",
      icon: Calendar,
      action: () =>
        document
          .getElementById("activity-form")
          ?.scrollIntoView({ behavior: "smooth" }),
    },
    {
      label: "Send Email",
      icon: Mail,
      href: `mailto:`,
    },
    {
      label: "Log Call",
      icon: Phone,
      action: () =>
        document
          .getElementById("activity-form")
          ?.scrollIntoView({ behavior: "smooth" }),
    },
  ];

  return (
    <div className="admin-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-dash-text">Quick Actions</h3>

      <div className="space-y-3">
        <label className="text-xs text-dash-muted">Change stage</label>
        <div className="flex gap-2">
          <Select value={newStage} onValueChange={setNewStage}>
            <SelectTrigger className="flex-1 border-dash-border bg-dash-surface-subtle text-dash-text text-xs">
              <SelectValue placeholder="Select stage..." />
            </SelectTrigger>
            <SelectContent>
              {stages
                .filter((s) => s !== currentStage)
                .map((s) => (
                  <SelectItem key={s} value={s}>
                    {stageLabels[s] ?? s}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            variant="secondary"
            size="sm"
            disabled={!newStage || changing}
            onClick={handleStageChange}
            className="shrink-0"
          >
            <ArrowRightCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {quickLinks.map((link) => (
          <button
            key={link.label}
            onClick={link.action}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-dash-text transition-colors hover:bg-dash-surface-subtle"
          >
            <link.icon className="h-4 w-4 text-dash-muted" />
            {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
