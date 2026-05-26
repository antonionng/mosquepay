import type { FeeLineItem } from "@/lib/fees/resolve";
import { formatFeeLabel } from "@/lib/fees/resolve";

type Props = {
  items: FeeLineItem[];
  total: number;
  className?: string;
};

export function FeeBreakdown({ items, total, className }: Props) {
  if (items.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm ${className ?? ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Your charges
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-4">
            <span
              className={
                item.waived ? "text-slate-500 line-through decoration-slate-400" : "text-slate-700"
              }
            >
              {formatFeeLabel(item)}
            </span>
            <span className="font-medium tabular-nums text-slate-900">
              {item.waived && item.amount === 0 ? (
                <span className="text-emerald-700 no-underline">Complimentary</span>
              ) : (
                `£${item.amount.toFixed(2)}`
              )}
            </span>
          </li>
        ))}
      </ul>
      {total > 0 && (
        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 font-semibold text-slate-900">
          <span>Total</span>
          <span className="tabular-nums">£{total.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
