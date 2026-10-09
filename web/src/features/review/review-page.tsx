import type { RunView } from '@/api/types';
import { Screen } from '@/components/layout/screen';
import { QueryView } from '@/components/shared/query-view';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { useReviewActions, useRun } from './api';
import { GeneratingState } from './components/generating-state';
import { ReviewSkeleton } from './components/review-skeleton';
import { ReviewWorkspace } from './components/review-workspace';
import { RunFailedState } from './components/run-failed-state';

function FailedRun({ run }: { run: RunView }) {
  const { retryRun } = useReviewActions(run.run_id, run.draft?.id);
  const retry = () => retryRun.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) });
  return <RunFailedState error={run.error} busy={retryRun.isPending} onRetry={retry} />;
}

function ReviewBody({ run, onRefresh }: { run: RunView; onRefresh: () => void }) {
  if (run.status === 'generating') return <GeneratingState createdAt={run.created_at} />;
  if (run.status === 'failed' || !run.draft) return <FailedRun run={run} />;
  return <ReviewWorkspace run={run} draft={run.draft} onRefresh={onRefresh} />;
}

export function ReviewPage({ id }: { id: string }) {
  const query = useRun(id);
  const title = query.data?.source?.title ?? (query.isError ? 'Not found' : 'Loading');
  return (
    <Screen crumbs={[{ label: 'Drafts', href: '#/drafts' }, { label: title }]}>
      <QueryView query={query} loading={<ReviewSkeleton />}>
        {(run) => <ReviewBody run={run} onRefresh={() => void query.refetch()} />}
      </QueryView>
    </Screen>
  );
}
