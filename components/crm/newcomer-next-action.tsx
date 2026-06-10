"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarClock, Loader2, Save } from "lucide-react";

export function NewcomerNextActionPanel({
  newcomerId,
  initialNextStep,
  initialNextStepDueDate,
}: {
  newcomerId: string;
  initialNextStep: string | null;
  initialNextStepDueDate: string | null;
}) {
  const router = useRouter();
  const [nextStep, setNextStep] = useState(initialNextStep ?? "");
  const [dueDate, setDueDate] = useState(
    initialNextStepDueDate ? initialNextStepDueDate.slice(0, 10) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/newcomers/church/${newcomerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          next_step: nextStep.trim() || null,
          next_step_due_date: dueDate || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="panel" className="overflow-hidden p-0">
      <div className="dash-panel-header rounded-none border-dash-border bg-dash-surface-subtle">
        <div>
          <h2 className="dash-panel-header-title">Next action</h2>
          <p className="dash-panel-header-description">
            Capture the single next step so this newcomer does not stall.
          </p>
        </div>
      </div>
      <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-6">
        <div className="space-y-2">
          <Label className="text-xs text-dash-muted">What is next?</Label>
          <Input
            value={nextStep}
            onChange={(e) => setNextStep(e.target.value)}
            placeholder="e.g. Invite to second informal service"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-dash-muted">Due by</Label>
          <Input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-between pt-1">
          <p className="flex items-center gap-1 text-xs text-dash-muted">
            <CalendarClock className="h-3 w-3" />
            Shown on the newcomer list and pipeline.
          </p>
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            disabled={saving}
            className="shrink-0"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-3.5 w-3.5" /> Save
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
