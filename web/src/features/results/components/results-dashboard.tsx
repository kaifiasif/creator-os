import { AlertTriangleIcon } from 'lucide-react';
import type { AcceptanceOpen } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AcceptanceChart } from './acceptance-chart';
import { AgentsCard } from './agents-card';
import { DriftCard } from './drift-card';
import { FlagsCard } from './flags-card';
import { MemoryCard } from './memory-card';
import { RejectionsCard } from './rejections-card';
import { ResultsStats } from './results-stats';
import { RunsTable } from './runs-table';

export function ResultsDashboard({ acceptance: a }: { acceptance: AcceptanceOpen }) {
  return (
    <>
      {a.below_prerequisite && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Below the prerequisite</AlertTitle>
          <AlertDescription>Your archive has fewer than 20 published pieces, so these numbers do not count yet. Import more posts on the Archive page.</AlertDescription>
        </Alert>
      )}
      <ResultsStats acceptance={a} />
      <AcceptanceChart weeks={a.by_week} />
      <div className="grid gap-4 md:gap-6 @3xl/main:grid-cols-2">
        <MemoryCard byMemory={a.by_memory} />
        <RejectionsCard rejections={a.rejections} />
        <AgentsCard agents={a.agents} />
        <FlagsCard flags={a.flags} />
        <DriftCard />
      </div>
      <RunsTable rows={a.table} />
    </>
  );
}
