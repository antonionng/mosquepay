"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ResponsiveTable renders as a table on tablet+ (md and up) and collapses
// into a list of tappable cards on phone. Phones should never sideways-scroll
// content — that's the single biggest "web feel" giveaway on a phone-sized
// admin list.
//
// Usage pattern is intentionally close to <Table>:
//   <ResponsiveTable columns={[...]} rows={items} rowHref={(r) => `/admin/x/${r.id}`} />
//
// Each column declares:
//   - key (column id)
//   - header (table th label)
//   - cell (renders the desktop td)
//   - mobile: "title" | "meta" | "trailing" | "hidden"
//       title    -> the bold first line of the phone card
//       meta     -> secondary muted lines, in order
//       trailing -> right-aligned chip (e.g. status badge / amount)
//       hidden   -> not shown on phone

export type ResponsiveColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  // Class applied to the desktop <th>/<td>. Use to hide intermediate
  // columns on medium screens (e.g. "hidden lg:table-cell").
  className?: string;
  // How this column projects onto the phone card.
  mobile?: "title" | "meta" | "trailing" | "hidden";
  // For mobile meta rows, an optional label prefix ("Status: …").
  mobileLabel?: string;
  // Column-level alignment for desktop only.
  align?: "left" | "right" | "center";
};

type ResponsiveTableProps<T> = {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  className?: string;
  // Controls the desktop table min-width when long columns force scroll
  // before we hit md. Defaults to 44rem to match the legacy <Table>.
  desktopMinWidth?: string;
};

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  onRowClick,
  emptyState,
  className,
  desktopMinWidth = "44rem",
}: ResponsiveTableProps<T>) {
  const titleColumn = columns.find((c) => c.mobile === "title");
  const metaColumns = columns.filter((c) => c.mobile === "meta");
  const trailingColumn = columns.find((c) => c.mobile === "trailing");

  if (rows.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-dash-border bg-dash-surface", className)}>
        <div className="p-8 text-center text-sm text-dash-muted">{emptyState ?? "Nothing here yet."}</div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Phone: stacked tappable cards. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const id = rowKey(row);
          const inner = (
            <div className="flex w-full items-center gap-3 rounded-2xl border border-dash-border bg-dash-surface p-4 text-left shadow-[var(--dash-shadow)] transition-colors active:bg-dash-surface-subtle">
              <div className="min-w-0 flex-1">
                {titleColumn ? (
                  <div className="truncate text-sm font-semibold text-dash-text">
                    {titleColumn.cell(row)}
                  </div>
                ) : null}
                {metaColumns.length > 0 ? (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dash-muted">
                    {metaColumns.map((col) => {
                      const value = col.cell(row);
                      if (value === null || value === undefined || value === "") return null;
                      return (
                        <span key={col.key} className="inline-flex min-w-0 max-w-full items-center gap-1 truncate">
                          {col.mobileLabel ? (
                            <span className="text-dash-faint">{col.mobileLabel}</span>
                          ) : null}
                          <span className="truncate">{value}</span>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {trailingColumn ? (
                <div className="flex shrink-0 items-center gap-2">{trailingColumn.cell(row)}</div>
              ) : null}
              {(rowHref || onRowClick) && (
                <ChevronRight className="h-4 w-4 shrink-0 text-dash-faint" aria-hidden />
              )}
            </div>
          );

          if (rowHref) {
            return (
              <li key={id}>
                <Link href={rowHref(row)} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg rounded-2xl">
                  {inner}
                </Link>
              </li>
            );
          }
          if (onRowClick) {
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onRowClick(row)}
                  className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dash-ring focus-visible:ring-offset-2 focus-visible:ring-offset-dash-bg rounded-2xl"
                >
                  {inner}
                </button>
              </li>
            );
          }
          return <li key={id}>{inner}</li>;
        })}
      </ul>

      {/* Tablet+ : full table. */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-2xl border border-dash-border bg-dash-surface shadow-[var(--dash-shadow)]">
          <div className="overflow-x-auto overscroll-x-contain">
            <table className="w-full text-sm text-dash-text" style={{ minWidth: desktopMinWidth }}>
              <thead className="border-b border-dash-border bg-dash-surface-subtle">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-dash-muted",
                        col.align === "right" && "text-right",
                        col.align === "center" && "text-center",
                        col.className
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                  {(rowHref || onRowClick) && <th className="w-10" aria-hidden />}
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border">
                {rows.map((row) => {
                  const id = rowKey(row);
                  const clickable = Boolean(rowHref || onRowClick);
                  const handleClick = () => {
                    if (rowHref) {
                      window.location.href = rowHref(row);
                    } else if (onRowClick) {
                      onRowClick(row);
                    }
                  };
                  return (
                    <tr
                      key={id}
                      className={cn(
                        "transition-colors",
                        clickable && "cursor-pointer hover:bg-dash-surface-subtle"
                      )}
                      onClick={clickable ? handleClick : undefined}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3.5 align-middle",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                            col.className
                          )}
                        >
                          {col.cell(row)}
                        </td>
                      ))}
                      {clickable && (
                        <td className="w-10 px-4 py-3.5 text-right">
                          <ChevronRight className="h-4 w-4 text-dash-faint" aria-hidden />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
