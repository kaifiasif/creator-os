import { AlertTriangleIcon } from 'lucide-react';
import { QueryView } from '@/components/shared/query-view';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { plural } from '@/lib/format';
import { useDrift } from '../api';
import type { DriftReady } from '../types';
import { DriftHistoryChart } from './drift-history-chart';
import { DriftPairs } from './drift-pairs';
import { MetricList } from './metric-list';

function DriftBody({ drift }: { drift: DriftReady }) {
  return (
    <div className="grid gap-6">
      {drift.alert && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Your outputs are getting more alike than your own writing</AlertTitle>
          <AlertDescription>Two weeks running, they sit above the range your archive ever reached. Vary the angles you pick or edit openings more.</AlertDescription>
        </Alert>
      )}
      <div className="grid gap-6 @3xl/main:grid-cols-2">
        <div className="grid content-start gap-3">
          <MetricList
            rows={[
              { label: 'Homogeneity ratio', value: drift.homogeneity_ratio.toFixed(2) },
              { label: 'Archive 90th percentile', value: drift.archive_p90.toFixed(2) },
              { label: 'Distance from your archive centre', value: drift.centroid_distance.toFixed(3) },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            A ratio above 1 means your last {plural(drift.outputs, 'output')} are more alike than your own posts usually are.
          </p>
        </div>
        <DriftHistoryChart history={drift.history} />
      </div>
      <DriftPairs pairs={drift.pairs} />
    </div>
  );
}

export function DriftCard() {
  const drift = useDrift(true);
  return (
    <Card className="@3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Voice drift</CardTitle>
        <CardDescription>Whether published outputs are converging on one way of writing.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryView query={drift} loading={<Skeleton className="h-40" />}>
          {(data) => (data.ready ? <DriftBody drift={data} /> : <p className="text-sm text-muted-foreground">{data.reason}</p>)}
        </QueryView>
      </CardContent>
    </Card>
  );
}
