"use client";

import { useCallback } from "react";
import { Layers, Plus, Trash2, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CATEGORIES,
  CATEGORY_BY_ID,
  lineItemsTotalMajor,
  newLineItemId,
  type CategoryId,
  type LineItemDraft,
} from "./types";

// "Split across categories" basket editor, shared by the Charge + Cash tabs.
//
// Two states:
//   * Empty  -> a single call-to-action that switches the form into itemised
//               mode, seeding the first row from whatever single amount /
//               category the operator had already entered.
//   * Filled -> one row per line item (category + amount + remove), an "add
//               another" button, a running total, and a way back to the
//               single-amount entry.
//
// The parent owns the items array (lifted into take-payment-client) so the
// basket survives switching between the Charge and Cash tabs.

export function LineItemsSection({
  items,
  setItems,
  seedAmount,
  seedCategory,
  disabled,
}: {
  items: LineItemDraft[];
  setItems: React.Dispatch<React.SetStateAction<LineItemDraft[]>>;
  seedAmount?: string;
  seedCategory?: CategoryId;
  disabled?: boolean;
}) {
  const itemised = items.length > 0;

  const addRow = useCallback(
    (category: CategoryId, amount: string) => {
      setItems((prev) => [
        ...prev,
        { id: newLineItemId(), category, amount },
      ]);
    },
    [setItems],
  );

  const startSplit = useCallback(() => {
    const seedNumber = Number(seedAmount);
    const firstAmount =
      Number.isFinite(seedNumber) && seedNumber > 0 ? String(seedNumber) : "";
    setItems([
      {
        id: newLineItemId(),
        category: seedCategory ?? "general",
        amount: firstAmount,
      },
      { id: newLineItemId(), category: "charity", amount: "" },
    ]);
  }, [seedAmount, seedCategory, setItems]);

  const updateRow = useCallback(
    (id: string, patch: Partial<Pick<LineItemDraft, "category" | "amount">>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [setItems],
  );

  const removeRow = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
    },
    [setItems],
  );

  const clearSplit = useCallback(() => {
    setItems([]);
  }, [setItems]);

  if (!itemised) {
    return (
      <button
        type="button"
        onClick={startSplit}
        disabled={disabled}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
      >
        <Layers className="h-4 w-4" />
        Split across categories (raffle, charity, dining…)
      </button>
    );
  }

  const total = lineItemsTotalMajor(items);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Layers className="h-4 w-4" />
          Itemised payment
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSplit}
          className="h-7 px-2 text-xs text-slate-500 hover:text-slate-700"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Back to single amount
        </Button>
      </div>

      <ul className="space-y-2">
        {items.map((item, idx) => {
          const giftAidable = CATEGORY_BY_ID[item.category]?.giftAidable;
          return (
            <li key={item.id} className="flex items-start gap-2">
              <div className="flex-1 space-y-1">
                <Select
                  value={item.category}
                  onValueChange={(v) =>
                    updateRow(item.id, { category: v as CategoryId })
                  }
                >
                  <SelectTrigger
                    aria-label={`Category for item ${idx + 1}`}
                    className="bg-white"
                  >
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Gift Aid eligible</SelectLabel>
                      {CATEGORIES.filter((c) => c.giftAidable).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Not Gift Aid eligible</SelectLabel>
                      {CATEGORIES.filter((c) => !c.giftAidable).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {giftAidable ? (
                  <p className="text-[11px] text-emerald-700">
                    Gift Aid eligible with a declaration
                  </p>
                ) : null}
              </div>
              <div className="relative w-28 flex-none">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                  £
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.amount}
                  onChange={(e) =>
                    updateRow(item.id, { amount: e.target.value })
                  }
                  aria-label={`Amount for item ${idx + 1}`}
                  className="ios-input bg-white pl-6 text-right tabular-nums"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeRow(item.id)}
                disabled={items.length <= 1}
                aria-label={`Remove item ${idx + 1}`}
                className="mt-0.5 h-9 w-9 flex-none text-slate-400 hover:text-red-600 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addRow("general", "")}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add item
        </Button>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Total
          </p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">
            £{total.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
