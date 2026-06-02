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
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-3.5 text-left transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
      >
        <Layers className="h-5 w-5 flex-none text-slate-500" />
        <span className="leading-tight">
          <span className="block text-sm font-medium text-slate-700">
            Split across categories
          </span>
          <span className="block text-xs text-slate-500">
            Raffle, charity &amp; dining on one payment
          </span>
        </span>
      </button>
    );
  }

  const total = lineItemsTotalMajor(items);

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Layers className="h-4 w-4" />
          Itemised payment
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={clearSplit}
          className="h-8 px-2 text-xs text-slate-500 hover:text-slate-700"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back to single amount</span>
          <span className="sm:hidden">Single</span>
        </Button>
      </div>

      <ul className="space-y-2.5">
        {items.map((item, idx) => {
          const giftAidable = CATEGORY_BY_ID[item.category]?.giftAidable;
          const removeBtn = (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRow(item.id)}
              disabled={items.length <= 1}
              aria-label={`Remove item ${idx + 1}`}
              className="h-12 w-11 flex-none text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:h-10 sm:w-10"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          );
          return (
            <li
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                {/* Category — full width on mobile so the label is readable */}
                <div className="flex items-center gap-2 sm:flex-1">
                  <div className="min-w-0 flex-1">
                    <Select
                      value={item.category}
                      onValueChange={(v) =>
                        updateRow(item.id, { category: v as CategoryId })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Category for item ${idx + 1}`}
                        className="h-12 w-full bg-white text-base sm:h-10 sm:text-sm"
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
                  </div>
                  {/* On mobile the remove button sits beside the category */}
                  <span className="sm:hidden">{removeBtn}</span>
                </div>

                {/* Amount — big tappable field on mobile */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-32 sm:flex-none">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-slate-400 sm:text-sm">
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
                      className="ios-input h-12 bg-white pl-7 text-right text-base tabular-nums sm:h-10 sm:text-sm"
                    />
                  </div>
                  {/* On tablet+ the remove button trails the row */}
                  <span className="hidden sm:inline-flex">{removeBtn}</span>
                </div>
              </div>
              {giftAidable ? (
                <p className="mt-1.5 pl-1 text-[11px] text-emerald-700 sm:mt-1">
                  Gift Aid eligible with a declaration
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 pt-0.5">
        <Button
          type="button"
          variant="outline"
          onClick={() => addRow("general", "")}
          className="h-11 flex-1 sm:h-9 sm:flex-none"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add item
        </Button>
        <div className="flex-none text-right">
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Total
          </p>
          <p className="text-xl font-semibold tabular-nums text-slate-900 sm:text-lg">
            £{total.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
}
