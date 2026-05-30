/**
 * Member rank and Masonic title helpers.
 *
 * The canonical rank stored on `members.rank` is one of five short codes:
 *
 *   EA      Entered Apprentice
 *   FC      Fellow Craft
 *   MM      Master Mason
 *   Master  Master (a brother in his year as Worshipful Master)
 *   PM      Past Master
 *
 * The Masonic title (Bro / W Bro / VW Bro / RW Bro) is derived from the
 * rank. We never store it directly. Bro is for unattained brethren and
 * Master Masons. W Bro is for sitting and Past Masters. VW Bro and RW Bro
 * are conferred by Provincial / Grand Lodge appointments and are tracked
 * separately via `member_ranks` rows; they are not derivable from craft
 * rank alone, so this helper returns at most "W Bro".
 */

export const RANK_CODES = ["EA", "FC", "MM", "Master", "PM"] as const;
export type Rank = (typeof RANK_CODES)[number];

export type MasonicTitle = "Bro" | "W Bro" | "VW Bro" | "RW Bro";

/** Human-readable label for each rank, in the order shown to users. */
export const RANK_LABELS: Record<Rank, string> = {
  EA: "Entered Apprentice",
  FC: "Fellow Craft",
  MM: "Master Mason",
  Master: "Master",
  PM: "Past Master",
};

/** True if the value is a recognised canonical rank code. */
export function isRank(value: unknown): value is Rank {
  return (
    typeof value === "string" &&
    (RANK_CODES as readonly string[]).includes(value)
  );
}

/**
 * Map a stored rank value to its Masonic title.
 *
 * Returns null when the rank is missing, blank, or not recognised. Callers
 * should fall back to omitting the title prefix in that case rather than
 * inventing one.
 */
export function masonicTitleFor(
  rank: string | null | undefined
): MasonicTitle | null {
  if (!rank) return null;
  switch (rank) {
    case "EA":
    case "FC":
    case "MM":
      return "Bro";
    case "Master":
    case "PM":
      return "W Bro";
    default:
      return null;
  }
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
