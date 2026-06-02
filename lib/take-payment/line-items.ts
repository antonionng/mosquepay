// Shared parsing + helpers for itemised take-payments.
//
// Both the QR mint route and the cash route accept an optional `line_items`
// array so a single payment can cover several categories at once (e.g.
// raffle + charity + dining on one QR). This module is the single source of
// truth for validating that array and for the small derivations (total,
// display category) the routes need so the two endpoints stay in lockstep.

import type { LineItemInput, TakePaymentCategory } from "./categorize";

// The set of category ids the take-payment UI offers. Typed as
// TakePaymentCategory so the literals are checked against the canonical
// category union at compile time, while staying server-safe (no "use client"
// module pulled into a route handler).
const KNOWN_CATEGORIES = new Set<TakePaymentCategory>([
  "general",
  "meeting_fee",
  "guest_ticket",
  "dining",
  "charity",
  "raffle",
  "subscriptions",
  "other",
]);

export type ParsedLineItem = {
  category: string;
  amount: number;
};

// Result of parseLineItems:
//   - { items: null }            -> no line items on the body; use the single-
//                                   amount path.
//   - { items: ParsedLineItem[] }-> a valid, normalised basket.
//   - { error }                  -> malformed; the route should return 400.
export type ParseLineItemsResult =
  | { items: ParsedLineItem[] | null; error?: undefined }
  | { items?: undefined; error: string };

// Parse + validate a raw `line_items` value off a request body.
export function parseLineItems(value: unknown): ParseLineItemsResult {
  if (value === undefined || value === null) return { items: null };
  if (!Array.isArray(value) || value.length === 0) return { items: null };

  const items: ParsedLineItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      return { error: "Each line item must have a category and an amount." };
    }
    const v = raw as Record<string, unknown>;
    const category =
      typeof v.category === "string" ? v.category.trim() : "general";
    if (!KNOWN_CATEGORIES.has(category as TakePaymentCategory)) {
      return { error: `Unknown category "${category}" on a line item.` };
    }
    const amount = Number(v.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: "Each line item needs an amount greater than zero." };
    }
    items.push({ category, amount: Math.round(amount * 100) / 100 });
  }

  if (items.length > 20) {
    return { error: "A payment cannot have more than 20 line items." };
  }
  return { items };
}

// Sum of all line item amounts, in major units, rounded to the penny.
export function lineItemsTotal(items: ParsedLineItem[]): number {
  const total = items.reduce((sum, it) => sum + it.amount, 0);
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

// The single category string to stash on metadata for an itemised payment so
// the history feed + receipt have something to show. One distinct category
// collapses to that category (behaves like a single-category payment);
// anything mixed is labelled "mixed".
export function deriveLineItemsCategory(items: ParsedLineItem[]): string {
  const distinct = Array.from(new Set(items.map((it) => it.category)));
  if (distinct.length === 0) return "general";
  if (distinct.length === 1) return distinct[0];
  return "mixed";
}

// Adapt ParsedLineItem[] to the projector's LineItemInput[] (same shape, kept
// as a named conversion so the dependency direction stays explicit).
export function toProjectorLineItems(items: ParsedLineItem[]): LineItemInput[] {
  return items.map((it) => ({ category: it.category, amount: it.amount }));
}
