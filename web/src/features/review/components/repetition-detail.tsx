import { ExternalLinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatPercent } from '@/lib/format';
import type { Checks } from '../lib/types';
import { DetailSection } from './detail-section';

export function RepetitionDetail({ repetition }: { repetition: Checks['repetition'] }) {
  const closest = repetition.matches[0];
  if (!repetition.flag) {
    if (!closest) return null;
    return (
      <DetailSection title="New to your archive" tone="supported">
        <p>
          The closest earlier post is {formatPercent(closest.similarity)} similar
          {repetition.threshold !== undefined ? `, below the ${formatPercent(repetition.threshold)} limit.` : '.'}
        </p>
      </DetailSection>
    );
  }
  return (
    <DetailSection title={repetition.severity === 'high' ? 'Close to an angle you retired' : 'Said before'} tone="repeat">
      {repetition.retired_match && (
        <div className="grid gap-1 rounded-md border p-2.5">
          <p className="text-foreground">{repetition.retired_match.text}</p>
          <p className="text-xs">
            Retired because: {repetition.retired_match.reason}. {formatPercent(repetition.retired_match.similarity)} similar.
          </p>
        </div>
      )}
      {repetition.matches.map((m) => (
        <div key={m.piece_id} className="grid gap-1 rounded-md border p-2.5">
          <p className="line-clamp-4 whitespace-pre-line text-foreground">{m.text}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span>Posted {formatDate(m.published_at)}</span>
            <span>{formatPercent(m.similarity)} similar</span>
            {m.retired && <Badge variant="outline">Retired</Badge>}
            {m.url && (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                Open on X <ExternalLinkIcon className="size-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </DetailSection>
  );
}
