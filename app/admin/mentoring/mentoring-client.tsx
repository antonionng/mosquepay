"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Loader2,
  Plus,
  StopCircle,
  Trash2,
  Users,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-action-dialog";

type MemberMini = {
  id: string;
  full_name: string;
  rank: string | null;
  date_of_initiation: string | null;
  date_of_passing: string | null;
  date_of_raising: string | null;
  progression_signed_off_initiation: boolean;
  progression_signed_off_passing: boolean;
  progression_signed_off_raising: boolean;
};

type Assignment = {
  id: string;
  mentor_member_id: string;
  mentee_member_id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

type Contact = {
  id: string;
  assignment_id: string | null;
  contacted_at: string;
  contact_method: string;
  topic: string | null;
  notes: string | null;
};

type Rung = {
  id: string;
  rung_label: string;
  sort_order: number;
  current_member_id: string | null;
  successor_member_id: string | null;
  notes: string | null;
};

const DEGREES: Array<{ key: "initiation" | "passing" | "raising"; label: string }> = [
  { key: "initiation", label: "Initiation (1°)" },
  { key: "passing", label: "Passing (2°)" },
  { key: "raising", label: "Raising (3°)" },
];

export function MentoringClient({
  members,
  assignments,
  contacts,
  rungs,
}: {
  members: MemberMini[];
  assignments: Assignment[];
  contacts: Contact[];
  rungs: Rung[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    mentor_member_id: "",
    mentee_member_id: "",
    notes: "",
  });
  const [newRung, setNewRung] = useState({
    rung_label: "",
    sort_order: rungs.length,
    current_member_id: "",
    successor_member_id: "",
    notes: "",
  });
  const [newContact, setNewContact] = useState<{
    assignment_id: string;
    contact_method: string;
    topic: string;
    notes: string;
  } | null>(null);
  const [endingAssignmentId, setEndingAssignmentId] = useState<string | null>(null);
  const [deletingRungId, setDeletingRungId] = useState<string | null>(null);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m])),
    [members]
  );

  async function recordProgression(
    memberId: string,
    degree: "initiation" | "passing" | "raising",
    date: string,
    signed: boolean
  ) {
    setBusy(`progression:${memberId}:${degree}`);
    try {
      const res = await fetch(`/api/progression/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ degree, date, signed_off: signed }),
      });
      if (!res.ok) throw new Error("Could not record progression.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!newAssignment.mentor_member_id || !newAssignment.mentee_member_id) {
      setFeedback("Pick a mentor and a mentee.");
      return;
    }
    setBusy("assign");
    try {
      const res = await fetch("/api/mentor/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAssignment),
      });
      if (!res.ok) throw new Error("Could not assign mentor.");
      setNewAssignment({ mentor_member_id: "", mentee_member_id: "", notes: "" });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Assign failed.");
    } finally {
      setBusy(null);
    }
  }

  async function logContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContact) return;
    setBusy("log-contact");
    try {
      const res = await fetch(
        `/api/mentor/assignments/${newContact.assignment_id}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_method: newContact.contact_method,
            topic: newContact.topic,
            notes: newContact.notes,
          }),
        }
      );
      if (!res.ok) throw new Error("Could not log contact.");
      setNewContact(null);
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Log failed.");
    } finally {
      setBusy(null);
    }
  }

  async function saveRung(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save-rung");
    try {
      const res = await fetch("/api/officer-ladder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rung_label: newRung.rung_label,
          sort_order: newRung.sort_order,
          current_member_id: newRung.current_member_id || null,
          successor_member_id: newRung.successor_member_id || null,
          notes: newRung.notes || null,
        }),
      });
      if (!res.ok) throw new Error("Could not save rung.");
      setNewRung({
        rung_label: "",
        sort_order: rungs.length + 1,
        current_member_id: "",
        successor_member_id: "",
        notes: "",
      });
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function endAssignment(id: string) {
    setBusy(`end-${id}`);
    setFeedback(null);
    try {
      const res = await fetch(`/api/mentor/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end: true }),
      });
      if (!res.ok) throw new Error("Could not end assignment.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteRung(id: string) {
    setBusy(`delete-rung:${id}`);
    try {
      const res = await fetch(`/api/officer-ladder/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete.");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Delete failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Mentoring &amp; progression
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track candidate progression through the three degrees, manage mentor
          assignments and contact log, and plan officer succession.
        </p>
      </div>

      {feedback && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
          {feedback}
        </div>
      )}

      <Tabs defaultValue="progression">
        <TabsList>
          <TabsTrigger value="progression">Progression</TabsTrigger>
          <TabsTrigger value="mentors">Mentors</TabsTrigger>
          <TabsTrigger value="ladder">Officer ladder</TabsTrigger>
        </TabsList>

        <TabsContent value="progression">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  {DEGREES.map((d) => (
                    <TableHead key={d.key}>{d.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="text-sm font-medium text-slate-900">
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="hover:text-blue-700"
                      >
                        {member.full_name}
                      </Link>
                      {member.rank && (
                        <span className="ml-2 text-xs text-slate-500">
                          {member.rank}
                        </span>
                      )}
                    </TableCell>
                    {DEGREES.map((degree) => {
                      const dateField =
                        degree.key === "initiation"
                          ? member.date_of_initiation
                          : degree.key === "passing"
                            ? member.date_of_passing
                            : member.date_of_raising;
                      const signed =
                        degree.key === "initiation"
                          ? member.progression_signed_off_initiation
                          : degree.key === "passing"
                            ? member.progression_signed_off_passing
                            : member.progression_signed_off_raising;
                      return (
                        <TableCell key={degree.key}>
                          <div className="space-y-1">
                            <input
                              type="date"
                              defaultValue={dateField ?? ""}
                              onBlur={(e) => {
                                if (e.target.value && e.target.value !== dateField) {
                                  recordProgression(
                                    member.id,
                                    degree.key,
                                    e.target.value,
                                    signed
                                  );
                                }
                              }}
                              className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs"
                            />
                            <button
                              type="button"
                              disabled={busy === `progression:${member.id}:${degree.key}`}
                              onClick={() =>
                                recordProgression(
                                  member.id,
                                  degree.key,
                                  dateField ?? new Date().toISOString().slice(0, 10),
                                  !signed
                                )
                              }
                              className={`flex w-full items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                                signed
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-500"
                              }`}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {signed ? "Signed off" : "Sign off"}
                            </button>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="mentors" className="space-y-4">
          <form
            onSubmit={createAssignment}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Assign mentor
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Mentor">
                <MemberSelect
                  members={members}
                  value={newAssignment.mentor_member_id}
                  onChange={(v) =>
                    setNewAssignment((a) => ({ ...a, mentor_member_id: v }))
                  }
                />
              </Field>
              <Field label="Mentee">
                <MemberSelect
                  members={members}
                  value={newAssignment.mentee_member_id}
                  onChange={(v) =>
                    setNewAssignment((a) => ({ ...a, mentee_member_id: v }))
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <input
                    value={newAssignment.notes}
                    onChange={(e) =>
                      setNewAssignment((a) => ({ ...a, notes: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-3 text-right">
              <Button type="submit" disabled={busy === "assign"}>
                {busy === "assign" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Assign
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mentor</TableHead>
                  <TableHead>Mentee</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Last contact</TableHead>
                  <TableHead className="w-32 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      No active mentor pairings.
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((a) => {
                    const lastContact = contacts
                      .filter((c) => c.assignment_id === a.id)
                      .sort(
                        (x, y) =>
                          new Date(y.contacted_at).getTime() -
                          new Date(x.contacted_at).getTime()
                      )[0];
                    const mentor = memberById.get(a.mentor_member_id);
                    const mentee = memberById.get(a.mentee_member_id);
                    const ended = Boolean(a.ended_at);
                    return (
                      <TableRow key={a.id} className={ended ? "opacity-60" : undefined}>
                        <TableCell className="text-sm">
                          {mentor ? (
                            <Link
                              href={`/admin/members/${mentor.id}`}
                              className="hover:text-blue-700"
                            >
                              {mentor.full_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {mentee ? (
                            <Link
                              href={`/admin/members/${mentee.id}`}
                              className="hover:text-blue-700"
                            >
                              {mentee.full_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {new Date(a.started_at).toLocaleDateString("en-GB")}
                          {ended && (
                            <Badge variant="secondary" className="ml-2">
                              Ended {new Date(a.ended_at!).toLocaleDateString("en-GB")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {lastContact ? (
                            <>
                              <p>
                                {new Date(lastContact.contacted_at).toLocaleDateString("en-GB")}
                              </p>
                              <Badge variant="secondary" className="mt-1">
                                {lastContact.contact_method}
                              </Badge>
                            </>
                          ) : (
                            <span className="text-slate-400">No contact logged</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {!ended && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setNewContact({
                                    assignment_id: a.id,
                                    contact_method: "meeting",
                                    topic: "",
                                    notes: "",
                                  })
                                }
                              >
                                <Plus className="mr-1 h-3 w-3" /> Log contact
                              </Button>
                            )}
                            {!ended && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy === `end-${a.id}`}
                                onClick={() => setEndingAssignmentId(a.id)}
                              >
                                {busy === `end-${a.id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <StopCircle className="h-3.5 w-3.5 text-rose-600" />
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="ladder" className="space-y-4">
          <form
            onSubmit={saveRung}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Add or update succession rung
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Office (e.g. Worshipful Master)">
                <input
                  value={newRung.rung_label}
                  onChange={(e) =>
                    setNewRung((r) => ({ ...r, rung_label: e.target.value }))
                  }
                  required
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  value={newRung.sort_order}
                  onChange={(e) =>
                    setNewRung((r) => ({
                      ...r,
                      sort_order: Number(e.target.value) || 0,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Current holder">
                <MemberSelect
                  members={members}
                  value={newRung.current_member_id}
                  onChange={(v) =>
                    setNewRung((r) => ({ ...r, current_member_id: v }))
                  }
                  allowEmpty
                />
              </Field>
              <Field label="Designated successor">
                <MemberSelect
                  members={members}
                  value={newRung.successor_member_id}
                  onChange={(v) =>
                    setNewRung((r) => ({ ...r, successor_member_id: v }))
                  }
                  allowEmpty
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Notes">
                  <input
                    value={newRung.notes}
                    onChange={(e) =>
                      setNewRung((r) => ({ ...r, notes: e.target.value }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  />
                </Field>
              </div>
            </div>
            <div className="mt-3 text-right">
              <Button type="submit" disabled={busy === "save-rung"}>
                <ArrowUpRight className="mr-2 h-4 w-4" /> Save rung
              </Button>
            </div>
          </form>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Successor</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rungs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                      <GraduationCap className="mx-auto mb-2 h-5 w-5 text-slate-300" />
                      No officers in the ladder yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  rungs.map((rung) => (
                    <TableRow key={rung.id}>
                      <TableCell className="text-sm text-slate-500">
                        {rung.sort_order}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-slate-900">
                        {rung.rung_label}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {(() => {
                          const m = memberById.get(rung.current_member_id ?? "");
                          if (!m) return <span className="text-slate-400">Vacant</span>;
                          return (
                            <Link
                              href={`/admin/members/${m.id}`}
                              className="hover:text-blue-700"
                            >
                              {m.full_name}
                            </Link>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {(() => {
                          const m = memberById.get(rung.successor_member_id ?? "");
                          if (!m) return <span className="text-slate-400">—</span>;
                          return (
                            <Link
                              href={`/admin/members/${m.id}`}
                              className="hover:text-blue-700"
                            >
                              {m.full_name}
                            </Link>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => setDeletingRungId(rung.id)}
                          disabled={busy === `delete-rung:${rung.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {newContact && (
        <div className="admin-modal-backdrop">
          <form
            onSubmit={logContact}
            className="admin-modal-panel-sm"
          >
            <h3 className="text-base font-semibold text-slate-900">
              Log mentor contact
            </h3>
            <div className="mt-3 space-y-3">
              <Field label="Method">
                <select
                  value={newContact.contact_method}
                  onChange={(e) =>
                    setNewContact((v) =>
                      v ? { ...v, contact_method: e.target.value } : v
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="meeting">Meeting</option>
                  <option value="phone">Phone</option>
                  <option value="video">Video</option>
                  <option value="email">Email</option>
                  <option value="visit">Visit</option>
                </select>
              </Field>
              <Field label="Topic">
                <input
                  value={newContact.topic}
                  onChange={(e) =>
                    setNewContact((v) =>
                      v ? { ...v, topic: e.target.value } : v
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                />
              </Field>
              <Field label="Notes">
                <textarea
                  value={newContact.notes}
                  onChange={(e) =>
                    setNewContact((v) =>
                      v ? { ...v, notes: e.target.value } : v
                    )
                  }
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNewContact(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy === "log-contact"}>
                <ClipboardCheck className="mr-2 h-4 w-4" /> Log
              </Button>
            </div>
          </form>
        </div>
      )}
      <ConfirmActionDialog
        open={endingAssignmentId !== null}
        onOpenChange={(open) => !open && setEndingAssignmentId(null)}
        title="End mentor pairing?"
        description="This closes the active assignment but keeps the history and contact log."
        confirmLabel="End pairing"
        tone="danger"
        loading={endingAssignmentId ? busy === `end-${endingAssignmentId}` : false}
        onConfirm={async () => {
          if (!endingAssignmentId) return;
          await endAssignment(endingAssignmentId);
          setEndingAssignmentId(null);
        }}
      />
      <ConfirmActionDialog
        open={deletingRungId !== null}
        onOpenChange={(open) => !open && setDeletingRungId(null)}
        title="Delete officer ladder rung?"
        description="This removes the office from the succession ladder. It does not change member records."
        confirmLabel="Delete rung"
        tone="danger"
        loading={deletingRungId ? busy === `delete-rung:${deletingRungId}` : false}
        onConfirm={async () => {
          if (!deletingRungId) return;
          await deleteRung(deletingRungId);
          setDeletingRungId(null);
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function MemberSelect({
  members,
  value,
  onChange,
  allowEmpty,
}: {
  members: MemberMini[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
    >
      <option value="">{allowEmpty ? "— Vacant —" : "— Select member —"}</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.full_name}
        </option>
      ))}
    </select>
  );
}
