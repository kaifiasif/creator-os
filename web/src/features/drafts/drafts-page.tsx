import { InboxIcon } from 'lucide-react';
import { useState } from 'react';
import type { RunList } from '@/api/types';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page';
import { QueryView } from '@/components/shared/query-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRuns } from './api';
import { DRAFT_FILTERS, type DraftFilter } from './components/draft-filters';
import { DraftStats } from './components/draft-stats';
import { DraftsSkeleton } from './components/drafts-skeleton';
import { ReviewQueue } from './components/review-queue';
import { RunsTable } from './components/runs-table';

const EMPTY_TEXT: Record<DraftFilter, string> = {
  review: 'Nothing is waiting for your review.',
  all: 'No drafts yet.',
  decided: 'No decided drafts waiting to be posted.',
  posted: 'Nothing marked as posted yet.',
};

function DraftsBody({ runs }: { runs: RunList }) {
  const [filter, setFilter] = useState<DraftFilter>(() => (runs.some(DRAFT_FILTERS[0].test) ? 'review' : 'all'));
  if (runs.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No drafts yet"
        description="Open a ready source in the Inbox and pick an angle to draft from it."
        action={
          <Button asChild>
            <a href="#/">Open the Inbox</a>
          </Button>
        }
      />
    );
  }
  return (
    <>
      <DraftStats runs={runs} />
      <ReviewQueue runs={runs.filter(DRAFT_FILTERS[0].test)} />
      <Tabs value={filter} onValueChange={(v) => setFilter(v as DraftFilter)}>
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {DRAFT_FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                {runs.filter(f.test).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        {DRAFT_FILTERS.map((f) => (
          <TabsContent key={f.value} value={f.value}>
            <RunsTable runs={runs.filter(f.test)} emptyText={EMPTY_TEXT[f.value]} />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

export function DraftsPage() {
  const runs = useRuns();
  return (
    <Screen crumbs={[{ label: 'Drafts' }]}>
      <PageHeader title="Drafts" description="Every draft written from your sources. Open one to check it and decide." />
      <QueryView query={runs} loading={<DraftsSkeleton />}>
        {(data) => <DraftsBody runs={data} />}
      </QueryView>
    </Screen>
  );
}
