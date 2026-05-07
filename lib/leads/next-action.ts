/**
 * Compute a human-readable "next action" prompt for a lead.
 * Used by lead list, kanban cards, and detail page so that secretaries see
 * a single concrete prompt rather than just a stage label.
 */

export type LeadPromptInput = {
  stage: string;
  daysSinceActivity: number;
  daysInStage: number;
  hasActivity: boolean;
  next_step: string | null;
  next_step_due_date: string | null;
  converted_at: string | null;
};

export type LeadPrompt = {
  /** Single short label, suitable for a chip or table cell. */
  label: string;
  /** Why we are showing this prompt. */
  reason: string;
  /** Severity drives colour: info (blue), warn (amber), urgent (red), ok (emerald). */
  severity: "info" | "warn" | "urgent" | "ok";
};

const STAGE_NEXT_HINT: Record<string, string> = {
  expression_of_interest: "Make first contact",
  new_enquiry: "Make first contact",
  initial_contact: "Schedule first informal meeting",
  meeting_scheduled: "Confirm meeting & log outcome",
  informal_meeting_1: "Arrange second informal meeting",
  meeting_2: "Begin proposal preparation",
  preflight_meeting: "Begin proposal preparation",
  application_completion: "Submit completed application",
  proposal_lodge: "Schedule ballot",
  approved: "Schedule initiation",
  initiation_briefing: "Schedule initiation",
  initiation: "Convert to member",
  initiated: "Convert to member",
};

const NOW = () => Date.now();
const DAY = 86400000;

export function getLeadPrompt(input: LeadPromptInput): LeadPrompt {
  if (input.converted_at) {
    return {
      label: "Member created",
      reason: "Lead has been converted to an active member.",
      severity: "ok",
    };
  }

  if (input.stage === "declined") {
    return {
      label: "Declined",
      reason: "Lead has been marked declined.",
      severity: "info",
    };
  }
  if (input.stage === "on_hold") {
    return {
      label: "On hold",
      reason: "Lead is parked and not in active pipeline.",
      severity: "info",
    };
  }

  if (input.next_step) {
    if (input.next_step_due_date) {
      const due = new Date(input.next_step_due_date).getTime();
      const diff = Math.floor((due - NOW()) / DAY);
      if (diff < 0) {
        return {
          label: input.next_step,
          reason: `Overdue by ${Math.abs(diff)}d`,
          severity: "urgent",
        };
      }
      if (diff <= 2) {
        return {
          label: input.next_step,
          reason: `Due ${diff === 0 ? "today" : `in ${diff}d`}`,
          severity: "warn",
        };
      }
      return {
        label: input.next_step,
        reason: `Due in ${diff}d`,
        severity: "info",
      };
    }
    return {
      label: input.next_step,
      reason: "Next step set, no due date",
      severity: "info",
    };
  }

  // No explicit next step set; suggest one based on stage and ageing.
  const hint = STAGE_NEXT_HINT[input.stage] ?? "Move forward";

  if (!input.hasActivity) {
    return {
      label: hint,
      reason: "No activity logged yet",
      severity: input.daysInStage >= 7 ? "urgent" : "warn",
    };
  }

  if (input.daysSinceActivity >= 14) {
    return {
      label: hint,
      reason: `${input.daysSinceActivity}d since activity`,
      severity: "urgent",
    };
  }
  if (input.daysSinceActivity >= 7) {
    return {
      label: hint,
      reason: `${input.daysSinceActivity}d since activity`,
      severity: "warn",
    };
  }
  return {
    label: hint,
    reason: "Suggested next step",
    severity: "info",
  };
}

export const PROMPT_CLASSES: Record<LeadPrompt["severity"], string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  warn: "border-amber-200 bg-amber-50 text-amber-900",
  urgent: "border-red-200 bg-red-50 text-red-900",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
};
