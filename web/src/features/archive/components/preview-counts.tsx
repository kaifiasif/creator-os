import type { ArchivePreview } from '@/api/types';

/** The four numbers that tell the creator what this file holds before they pick rows. */
export function PreviewCounts({ counts }: { counts: ArchivePreview['counts'] }) {
  const items = [
    { label: 'New', value: counts.new },
    { label: 'Already imported', value: counts.exists },
    { label: 'Threads', value: counts.threads },
    { label: 'Left out', value: counts.excluded },
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border px-3 py-2">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
