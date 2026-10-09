import { UsersIcon } from 'lucide-react';
import type { SourceDetail } from '@/api/types';
import { PageHeader } from '@/components/shared/page';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import { SOURCE_KIND, SOURCE_STATUS } from '@/lib/labels';
import { ChangeSpeakerDialog } from './change-speaker-dialog';

export function SourceHeader({ source }: { source: SourceDetail }) {
  const canChangeSpeaker = source.status === 'ready' && (source.speakers?.length ?? 0) > 1 && source.runs.length === 0;
  return (
    <PageHeader
      title={source.title}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{SOURCE_KIND[source.kind]}</Badge>
          <StatusBadge status={SOURCE_STATUS[source.status]} />
          {source.creator_speaker && (source.speakers?.length ?? 0) > 1 && (
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" aria-hidden /> You are {source.creator_speaker}
            </span>
          )}
          <span>Added {formatDate(source.created_at)}</span>
        </span>
      }
      actions={canChangeSpeaker ? <ChangeSpeakerDialog source={source} /> : undefined}
    />
  );
}
