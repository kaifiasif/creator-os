import type { SourceDetail } from '@/api/types';
import { hrefOf } from '@/app/router';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import { RUN_STATUS } from '@/lib/labels';
import { DRAFT_FORMAT } from '@/lib/labels';

/** Drafts already started from this source, each linking to its review. */
export function SourceRuns({ runs }: { runs: SourceDetail['runs'] }) {
  if (!runs.length) return null;
  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Drafts from this source</CardTitle>
        <CardDescription>Open one to review it.</CardDescription>
      </CardHeader>
      <CardContent className="px-2">
        <ul className="grid">
          {runs.map((run) => (
            <li key={run.id}>
              <a href={hrefOf({ name: 'review', id: run.id })} className="flex items-center gap-3 rounded-md px-4 py-2 text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <span className="flex-1 font-medium">{DRAFT_FORMAT[run.format]}</span>
                <span className="text-muted-foreground">{formatDate(run.created_at)}</span>
                <StatusBadge status={RUN_STATUS[run.status]} />
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
