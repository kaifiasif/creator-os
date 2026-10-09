import type { SourceDetail } from '@/api/types';
import { FailedState } from './failed-state';
import { MappingState } from './mapping-state';
import { NothingPostableState } from './nothing-postable-state';
import { ProcessingCard } from './processing-card';
import { ReadyView } from './ready-view';

/** What the source page shows depends on where the source is in its pipeline. */
export function SourceBody({ source }: { source: SourceDetail }) {
  switch (source.status) {
    case 'transcribing':
    case 'extracting':
      return <ProcessingCard status={source.status} />;
    case 'mapping':
      return <MappingState source={source} />;
    case 'failed':
      return <FailedState source={source} />;
    case 'nothing_postable':
      return <NothingPostableState source={source} />;
    case 'ready':
      return <ReadyView source={source} />;
  }
}
