import type { RunSummary } from '@/api/types';
import { StatCard } from '@/components/shared/stat-card';
import { plural } from '@/lib/format';
import { draftCounts } from './draft-filters';

export function DraftStats({ runs }: { runs: RunSummary[] }) {
  const n = draftCounts(runs);
  return (
    <div className="grid grid-cols-2 gap-4 @5xl/main:grid-cols-4">
      <StatCard
        label="Waiting for review"
        value={n.waiting}
        footnote={n.drafting ? `${plural(n.drafting, 'draft')} still being written` : n.waiting ? 'Open one to decide' : 'Nothing waiting on you'}
      />
      <StatCard label="Decided" value={n.decided} footnote="Accepted, edited or rejected" />
      <StatCard label="Posted" value={n.posted} footnote="Marked as posted on X" />
      <StatCard label="Failed" value={n.failed} footnote={n.failed ? 'Open one to try again' : 'No failed drafts'} />
    </div>
  );
}
