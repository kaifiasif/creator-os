import { Screen } from '@/components/layout/screen';
import { QueryView } from '@/components/shared/query-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useSource } from './api';
import { SourceBody } from './components/source-body';
import { SourceHeader } from './components/source-header';

function Loading() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-8 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function SourcePage({ id }: { id: string }) {
  const source = useSource(id);
  return (
    <Screen crumbs={[{ label: 'Inbox', href: '#/' }, { label: source.data?.title ?? 'Source' }]}>
      <QueryView query={source} loading={<Loading />}>
        {(data) => (
          <>
            <SourceHeader source={data} />
            <SourceBody source={data} />
          </>
        )}
      </QueryView>
    </Screen>
  );
}
