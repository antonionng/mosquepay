/**
 * Legacy leadership label helpers.
 *
 * ChurchPay no longer uses legacy rank-based titles. These helpers remain so older
 * screens can render legacy data safely while new records should use
 * leadership roles and ministry/team labels instead.
 */

export const RANK_CODES = ["Member", "Leader", "Deacon", "Elder", "Pastor"] as const;
export type Rank = (typeof RANK_CODES)[number];

export type ChurchTitle = string;

/** Human-readable label for each rank, in the order shown to users. */
export const RANK_LABELS: Record<Rank, string> = {
  Member: "Member",
  Leader: "Ministry leader",
  Deacon: "Deacon",
  Elder: "Elder",
  Pastor: "Pastor",
};

/** True if the value is a recognised canonical rank code. */
export function isRank(value: unknown): value is Rank {
  return (
    typeof value === "string" &&
    (RANK_CODES as readonly string[]).includes(value)
  );
}

/**
 * Map a stored rank value to its Church title.
 *
 * Returns null when the rank is missing, blank, or not recognised. Callers
 * should fall back to omitting the title prefix in that case rather than
 * inventing one.
 */
export function churchTitleFor(
  rank: string | null | undefined
): ChurchTitle | null {
  return rankLabel(rank);
}

/**
 * Human label for display, e.g. on a profile or table cell. Falls back to
 * the raw value when the rank is non-canonical so that legacy data still
 * renders something meaningful while the constraint is rolled out.
 */
export function rankLabel(rank: string | null | undefined): string | null {
  if (!rank) return null;
  if (isRank(rank)) return RANK_LABELS[rank];
  return rank;
}
