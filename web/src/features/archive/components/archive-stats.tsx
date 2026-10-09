import { Badge } from '@/components/ui/badge';
import { StatCard, StatGrid } from '@/components/shared/stat-card';
import type { ArchiveList } from '@/api/types';
import { plural } from '@/lib/format';

const MIN_PIECES = 20;

export function ArchiveStats({ archive }: { archive: ArchiveList }) {
  const missing = MIN_PIECES - archive.total;
  return (
    <StatGrid>
      <StatCard
        label="Published pieces"
        value={archive.total}
        badge={archive.below_prerequisite && <Badge variant="outline">Below {MIN_PIECES}</Badge>}
        footnote={archive.below_prerequisite ? `Import ${plural(missing, 'more post')} before results count.` : 'Every draft is checked against these.'}
      />
      <StatCard label="Held out for testing" value={archive.holdout} footnote="Never used as reference, so the checks can be tested on them." />
      <StatCard label="Retired angles" value={archive.retired} footnote="Drafts that say these again are flagged." />
      <StatCard
        label="Repeat threshold"
        value={archive.repetition_threshold.toFixed(2)}
        footnote={<span className="truncate">Embeddings from {archive.embedding_provider}</span>}
      />
    </StatGrid>
  );
}
