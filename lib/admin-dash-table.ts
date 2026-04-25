/** shadcn Table + dash tokens for admin data panels */
export const DASH_TABLE = {
  table: "text-dash-text",
  header: "border-b border-dash-border bg-dash-surface-subtle [&_tr]:border-0",
  head: "h-11 px-4 text-xs font-semibold uppercase tracking-[0.08em] text-dash-text-muted",
  row: "border-b border-dash-border transition-colors hover:bg-dash-surface-subtle/70 data-[state=selected]:bg-dash-surface-subtle",
  cell: "p-4 align-middle text-sm text-dash-text",
  cellMuted: "p-4 align-middle text-sm text-dash-text-muted",
  cellRight: "p-4 text-right align-middle text-sm text-dash-text",
} as const;
