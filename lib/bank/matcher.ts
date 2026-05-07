import type { LedgerEntry } from "@/lib/db/types";
import type { ParsedBankRow } from "./csv-parser";

export type MatchProposal = {
  source_type: "payment" | "dues" | "donation";
  source_id: string;
  confidence: number;
};

const DAY_MS = 1000 * 60 * 60 * 24;

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function similarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection++;
  const union = new Set([...ta, ...tb]).size;
  return intersection / union;
}

export function proposeMatch(
  row: ParsedBankRow,
  ledger: LedgerEntry[]
): MatchProposal | null {
  if (row.direction !== "credit") return null;

  const rowDateTime = new Date(row.posted_date).getTime();
  const haystack = `${row.description} ${row.reference ?? ""}`;

  let best: MatchProposal | null = null;

  for (const entry of ledger) {
    if (entry.status !== "completed" && entry.status !== "paid" && entry.status !== "succeeded") continue;
    if (Math.abs(Number(entry.amount) - row.amount) > 0.01) continue;

    const entryDate = new Date(entry.occurred_at).getTime();
    const dayDelta = Math.abs(rowDateTime - entryDate) / DAY_MS;
    if (dayDelta > 14) continue;

    const dateScore = Math.max(0, 1 - dayDelta / 14);
    const nameScore = Math.max(
      similarity(haystack, entry.contact_name ?? ""),
      similarity(haystack, entry.contact_email ?? "")
    );
    const referenceMatch = entry.metadata?.reference
      ? haystack.toLowerCase().includes(String(entry.metadata.reference).toLowerCase())
        ? 1
        : 0
      : 0;

    const confidence = Math.min(
      1,
      0.55 + dateScore * 0.25 + nameScore * 0.4 + referenceMatch * 0.15
    );

    if (!best || confidence > best.confidence) {
      best = {
        source_type: entry.source_type,
        source_id: entry.source_id,
        confidence: Number(confidence.toFixed(2)),
      };
    }
  }

  if (!best || best.confidence < 0.7) return null;
  return best;
}
