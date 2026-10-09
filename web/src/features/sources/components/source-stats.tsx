import type { SourceList, SourceStatus } from '@/api/types';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { SOURCE_STATUS } from '@/lib/labels';

const count = (sources: SourceList, ...statuses: SourceStatus[]) => sources.filter((s) => statuses.includes(s.status)).length;

/** Where the inbox stands: what can be drafted, what needs the creator, what is still running. */
export function SourceStats({ sources }: { sources: SourceList }) {
  const failed = count(sources, 'failed');
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 @5xl/main:grid-cols-4">
      <StatCard label="Ready to draft" value={count(sources, 'ready')} footnote="Claims found and checked word for word" />
      <StatCard label="Waiting for your voice pick" value={count(sources, 'mapping')} footnote="Calls where you say which speaker is you" />
      <StatCard label="Being processed" value={count(sources, 'transcribing', 'extracting')} footnote="Transcribing or finding claims. This updates on its own." />
      <StatCard
        label="Failed"
        value={failed}
        badge={failed > 0 ? <StatusBadge status={SOURCE_STATUS.failed} /> : undefined}
        footnote={failed ? 'Open one to retry or paste its transcript' : 'Nothing needs fixing'}
      />
    </div>
  );
}
