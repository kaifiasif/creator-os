import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/format';
import { excerpt } from '../excerpt';
import { PREVIEW_STATUS } from '@/lib/labels';
import type { PreviewRow } from '../types';
import { usePaged } from '../use-paged';
import { TablePager } from './table-pager';

const PAGE_SIZE = 50;

interface Props {
  rows: PreviewRow[];
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onToggleMany: (ids: string[], on: boolean) => void;
}

/** Every parsed row with a checkbox. Rows already in the archive are shown but cannot be picked. */
export function PreviewRowsTable({ rows, selected, onToggle, onToggleMany }: Props) {
  const paged = usePaged(rows, PAGE_SIZE);
  const newIds = rows.filter((r) => r.status === 'new').map((r) => r.external_id);
  const picked = newIds.filter((id) => selected.has(id)).length;
  const allState = picked === 0 ? false : picked === newIds.length ? true : 'indeterminate';

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label="Select every new post" checked={allState} disabled={!newIds.length} onCheckedChange={(v) => onToggleMany(newIds, v === true)} />
              </TableHead>
              <TableHead>Post</TableHead>
              <TableHead className="hidden w-36 sm:table-cell">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.slice.map((row) => {
              const isNew = row.status === 'new';
              return (
                <TableRow key={row.external_id} data-state={selected.has(row.external_id) ? 'selected' : undefined}>
                  <TableCell className="align-top">
                    <Checkbox
                      aria-label="Import this post"
                      checked={isNew && selected.has(row.external_id)}
                      disabled={!isNew}
                      onCheckedChange={(v) => onToggle(row.external_id, v === true)}
                    />
                  </TableCell>
                  <TableCell className="max-w-0 whitespace-normal">
                    <p className={isNew ? 'line-clamp-2' : 'line-clamp-2 text-muted-foreground'}>{excerpt(row.text)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(row.published_at)}</span>
                      {row.parts && <Badge variant="outline">Thread of {row.parts.length}</Badge>}
                      <span className="sm:hidden">{PREVIEW_STATUS[row.status]}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden align-top sm:table-cell">
                    <Badge variant={isNew ? 'secondary' : 'outline'}>{PREVIEW_STATUS[row.status]}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
            {!rows.length && (
              <TableRow>
                <TableCell colSpan={3} className="h-20 text-center text-muted-foreground">
                  No posts found in this file.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePager paged={paged} noun="rows" />
    </div>
  );
}
