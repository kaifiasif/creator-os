import type { ReactNode } from 'react';
import type { SourceList } from '@/api/types';
import { hrefOf } from '@/app/router';
import { StatusBadge } from '@/components/shared/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { SOURCE_KIND, SOURCE_STATUS } from '@/lib/labels';

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader className="bg-muted">
          <TableRow>
            <TableHead className="w-full pl-4">Title</TableHead>
            <TableHead className="hidden md:table-cell">Kind</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Your claims</TableHead>
            <TableHead className="hidden text-right lg:table-cell">Drafts</TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell">Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

export function SourcesTable({ sources }: { sources: SourceList }) {
  return (
    <Frame>
      {sources.map((source) => (
        <TableRow key={source.id}>
          <TableCell className="pl-4">
            <a href={hrefOf({ name: 'source', id: source.id })} className="block max-w-[12rem] truncate font-medium sm:max-w-sm xl:max-w-lg hover:underline focus-visible:underline focus-visible:outline-none">
              {source.title}
            </a>
            {source.status === 'failed' && source.error && <p className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-sm xl:max-w-lg">{source.error}</p>}
            <p className="truncate text-xs text-muted-foreground md:hidden">{SOURCE_KIND[source.kind]}</p>
          </TableCell>
          <TableCell className="hidden text-muted-foreground md:table-cell">{SOURCE_KIND[source.kind]}</TableCell>
          <TableCell>
            <StatusBadge status={SOURCE_STATUS[source.status]} />
          </TableCell>
          <TableCell className="hidden text-right tabular-nums lg:table-cell">{source.creator_claims}</TableCell>
          <TableCell className="hidden text-right tabular-nums lg:table-cell">{source.runs}</TableCell>
          <TableCell className="hidden pr-4 text-right text-muted-foreground sm:table-cell">
            <time dateTime={source.created_at} title={formatDate(source.created_at)}>
              {formatRelative(source.created_at)}
            </time>
          </TableCell>
        </TableRow>
      ))}
    </Frame>
  );
}

export function SourcesTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Frame>
      {Array.from({ length: rows }, (_, i) => (
        <TableRow key={i}>
          <TableCell className="pl-4">
            <Skeleton className="h-4 w-48" />
          </TableCell>
          <TableCell className="hidden md:table-cell">
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-24 rounded-full" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="ml-auto h-4 w-6" />
          </TableCell>
          <TableCell className="hidden lg:table-cell">
            <Skeleton className="ml-auto h-4 w-6" />
          </TableCell>
          <TableCell className="hidden pr-4 sm:table-cell">
            <Skeleton className="ml-auto h-4 w-16" />
          </TableCell>
        </TableRow>
      ))}
    </Frame>
  );
}
