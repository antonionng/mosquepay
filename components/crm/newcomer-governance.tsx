"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";

export type GovernanceMember = { id: string; name: string };

export function NewcomerGovernancePanel({
  newcomerId,
  members,
  initial,
}: {
  newcomerId: string;
  members: GovernanceMember[];
  initial: {
    proposer_member_id: string | null;
    proposer_name: string | null;
    seconder_member_id: string | null;
    seconder_name: string | null;
    proposal_date: string | null;
    membership_decision_date: string | null;
    interview_completed_at: string | null;
    consent_given_at: string | null;
    notes: string | null;
  };
}) {
  const router = useRouter();
  const [proposer, setProposer] = useState(
    initial.proposer_member_id ?? "__custom"
  );
  const [proposerName, setProposerName] = useState(initial.proposer_name ?? "");
  const [seconder, setSeconder] = useState(
    initial.seconder_member_id ?? "__custom"
  );
  const [seconderName, setSeconderName] = useState(initial.seconder_name ?? "");
  const [proposalDate, setProposalDate] = useState(
    initial.proposal_date ? initial.proposal_date.slice(0, 10) : ""
  );
  const [membershipDecisionDate, setMembershipDecisionDate] = useState(
    initial.membership_decision_date ? initial.membership_decision_date.slice(0, 10) : ""
  );
  const [interviewDate, setInterviewDate] = useState(
    initial.interview_completed_at
      ? initial.interview_completed_at.slice(0, 10)
      : ""
  );
  const [consentGiven, setConsentGiven] = useState(
    Boolean(initial.consent_given_at)
  );
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const proposerIsMember = proposer && proposer !== "__custom";
      const seconderIsMember = seconder && seconder !== "__custom";

      const res = await fetch(`/api/newcomers/mosque/${newcomerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposer_member_id: proposerIsMember ? proposer : null,
          proposer_name: proposerIsMember ? null : proposerName.trim() || null,
          seconder_member_id: seconderIsMember ? seconder : null,
          seconder_name: seconderIsMember ? null : seconderName.trim() || null,
          proposal_date: proposalDate || null,
          membership_decision_date: membershipDecisionDate || null,
          interview_completed_at: interviewDate
            ? new Date(interviewDate).toISOString()
            : null,
          consent_given_at: consentGiven
            ? initial.consent_given_at ?? new Date().toISOString()
            : null,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save");
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
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
          <h2 className="dash-panel-header-title">Recruitment governance</h2>
          <p className="dash-panel-header-description">
            Proposer, seconder, membership decision and consent for the newcomer file.
          </p>
        </div>
      </div>
      <CardContent className="space-y-4 border-t border-dash-border bg-dash-surface p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs text-dash-muted">Proposer</Label>
            <Select value={proposer} onValueChange={setProposer}>
              <SelectTrigger>
                <SelectValue placeholder="Select member..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Other / non-member</SelectItem>
              </SelectContent>
            </Select>
            {proposer === "__custom" && (
              <Input
                value={proposerName}
                onChange={(e) => setProposerName(e.target.value)}
                placeholder="Proposer name"
                className="mt-2"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-dash-muted">Seconder</Label>
            <Select value={seconder} onValueChange={setSeconder}>
              <SelectTrigger>
                <SelectValue placeholder="Select member..." />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
                <SelectItem value="__custom">Other / non-member</SelectItem>
              </SelectContent>
            </Select>
            {seconder === "__custom" && (
              <Input
                value={seconderName}
                onChange={(e) => setSeconderName(e.target.value)}
                placeholder="Seconder name"
                className="mt-2"
              />
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-xs text-dash-muted">Interview completed</Label>
            <Input
              type="date"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-dash-muted">Proposal date</Label>
            <Input
              type="date"
              value={proposalDate}
              onChange={(e) => setProposalDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-dash-muted">Membership decision date</Label>
            <Input
              type="date"
              value={membershipDecisionDate}
              onChange={(e) => setMembershipDecisionDate(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-dash-text">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="font-medium">Data protection consent recorded</span>
            <span className="block text-xs text-dash-muted">
              Confirm the newcomer has agreed to the mosque holding their data.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <Label className="text-xs text-dash-muted">Newcomer notes (private)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Background, references, previous mosques, anything relevant for the sponsor or pastoral contact"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && (
          <p className="text-xs text-emerald-700">Saved.</p>
        )}

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            variant="primary"
            onClick={save}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-3.5 w-3.5" /> Save governance
              </span>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
