import type { ReactNode } from 'react';

/** Label on the left, number on the right, one row each. */
export function MetricList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="text-right font-medium tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
