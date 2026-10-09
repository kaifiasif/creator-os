import type { RunSummary } from '@/api/types';
import { navigate } from '@/app/router';
import { StatusBadge } from '@/components/shared/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { RUN_STATUS } from '@/lib/labels';

const FORMAT: Record<RunSummary['format'], string> = { post: 'Single post', thread: 'Thread' };

export function RunsTable({ runs, emptyText }: { runs: RunSummary[]; emptyText: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="pl-4">Source</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Format</TableHead>
            <TableHead className="hidden text-right md:table-cell">Decisions</TableHead>
            <TableHead className="hidden lg:table-cell">Posted</TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
          {runs.map((run) => (
            <TableRow key={run.id} className="cursor-pointer" onClick={() => navigate({ name: 'review', id: run.id })}>
              <TableCell className="max-w-0 pl-4 font-medium sm:max-w-none">
                <a href={`#/drafts/${run.id}`} className="block truncate rounded-sm hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none" onClick={(e) => e.stopPropagation()}>
                  {run.source_title}
                </a>
              </TableCell>
              <TableCell>
                <StatusBadge status={RUN_STATUS[run.status]} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{FORMAT[run.format]}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{run.decisions}</TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{run.posted_at ? formatDate(run.posted_at) : 'Not yet'}</TableCell>
              <TableCell className="hidden pr-4 text-right text-muted-foreground sm:table-cell">{formatRelative(run.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
