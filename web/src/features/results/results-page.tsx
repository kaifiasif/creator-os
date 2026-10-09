import { Screen } from '@/components/layout/screen';
import { PageHeader } from '@/components/shared/page';
import { QueryView } from '@/components/shared/query-view';
import { Skeleton } from '@/components/ui/skeleton';
import { plural } from '@/lib/format';
import { useAcceptance } from './api';
import { LockedNotice } from './components/locked-notice';
import { ResultsDashboard } from './components/results-dashboard';

function Loading() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function ResultsPage() {
  const acceptance = useAcceptance();
  const data = acceptance.data;
  const description =
    data && !data.locked
      ? `Do the checks help? Based on ${plural(data.runs, 'decided run')}. With this few runs, read the numbers as a direction, not a verdict.`
      : 'Do the checks help? The numbers open once every draft has a first decision.';

  return (
    <Screen crumbs={[{ label: 'Results' }]}>
      <PageHeader title="Results" description={description} />
      <QueryView query={acceptance} loading={<Loading />}>
        {(a) => (a.locked ? <LockedNotice locked={a} /> : <ResultsDashboard acceptance={a} />)}
      </QueryView>
    </Screen>
  );
}
