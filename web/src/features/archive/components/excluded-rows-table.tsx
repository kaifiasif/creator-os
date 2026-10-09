import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { excerpt } from '../excerpt';
import { EXCLUDED_REASON } from '@/lib/labels';
import type { ExcludedRow } from '../types';
import { usePaged } from '../use-paged';
import { TablePager } from './table-pager';

/** Retweets and replies to other people. They are not your writing, so they stay out. */
export function ExcludedRowsTable({ rows }: { rows: ExcludedRow[] }) {
  const paged = usePaged(rows, 50);
  if (!rows.length) return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nothing was left out.</p>;
  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead className="w-24">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.slice.map((row) => (
              <TableRow key={row.external_id}>
                <TableCell className="max-w-0 whitespace-normal">
                  <p className="line-clamp-2 text-muted-foreground">{excerpt(row.text)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(row.published_at)}</p>
                </TableCell>
                <TableCell className="align-top">
                  <Badge variant="outline">{EXCLUDED_REASON[row.reason]}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <TablePager paged={paged} noun="rows" />
    </div>
  );
}
