import { InboxIcon, PlusIcon } from 'lucide-react';
import { openOverlay } from '@/app/ui-state';
import { Screen } from '@/components/layout/screen';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page';
import { QueryView } from '@/components/shared/query-view';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { useSources } from './api';
import { SourceStats } from './components/source-stats';
import { SourcesTable, SourcesTableSkeleton } from './components/sources-table';

const capture = () => openOverlay('capture');

function Loading() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <SourcesTableSkeleton />
    </>
  );
}

export function InboxPage() {
  const sources = useSources();
  return (
    <Screen crumbs={[{ label: 'Inbox' }]}>
      <PageHeader
        title="Inbox"
        description="Everything you have captured, and where each one is on its way to a draft."
        actions={
          <Button onClick={capture}>
            <PlusIcon /> New capture <Kbd className="hidden bg-primary-foreground/15 text-primary-foreground sm:inline-flex">C</Kbd>
          </Button>
        }
      />
      <QueryView query={sources} loading={<Loading />}>
        {(list) =>
          list.length ? (
            <>
              <SourceStats sources={list} />
              <SourcesTable sources={list} />
            </>
          ) : (
            <EmptyState
              icon={InboxIcon}
              title="Your inbox is empty"
              description="Capture a voice memo, a call or rough notes. Claims are pulled out with your exact words, ready to draft from."
              action={
                <Button onClick={capture}>
                  <PlusIcon /> New capture
                </Button>
              }
            />
          )
        }
      </QueryView>
    </Screen>
  );
}
