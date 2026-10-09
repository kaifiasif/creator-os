import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { excerpt } from '../excerpt';
import type { Piece } from '../types';
import { usePaged } from '../use-paged';
import { PieceActions } from './piece-actions';
import { PieceBadges } from './piece-badges';
import { RetireDialog } from './retire-dialog';
import { TablePager } from './table-pager';

const PAGE_SIZE = 20;

export function PiecesTable({ pieces }: { pieces: Piece[] }) {
  const [query, setQuery] = useState('');
  const [retiring, setRetiring] = useState<Piece | null>(null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? pieces.filter((p) => p.text.toLowerCase().includes(needle)) : pieces;
  }, [pieces, query]);
  const paged = usePaged(matches, PAGE_SIZE);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <InputGroup className="w-full sm:w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              paged.setPage(0);
            }}
            placeholder="Search your posts"
            aria-label="Search your posts"
          />
        </InputGroup>
        {query.trim() && <span className="text-sm text-muted-foreground">{plural(matches.length, 'match', 'matches')}</span>}
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Post</TableHead>
              <TableHead className="hidden w-32 md:table-cell">Published</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.slice.map((piece) => (
              <TableRow key={piece.id}>
                <TableCell className="max-w-0 py-3 whitespace-normal">
                  <p className={cn('line-clamp-2 text-sm', piece.retired && 'text-muted-foreground')}>{excerpt(piece.text)}</p>
                  {piece.retired_reason && <p className="mt-1 text-xs text-muted-foreground">Retired because {piece.retired_reason}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground md:hidden">{formatDate(piece.published_at)}</span>
                    <PieceBadges piece={piece} />
                  </div>
                </TableCell>
                <TableCell className="hidden align-top text-muted-foreground tabular-nums md:table-cell md:pt-3">{formatDate(piece.published_at)}</TableCell>
                <TableCell className="align-top">
                  <PieceActions piece={piece} onRetire={setRetiring} />
                </TableCell>
              </TableRow>
            ))}
            {!paged.slice.length && (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No posts match. Try a different word.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <TablePager paged={paged} noun="posts" />
      <RetireDialog piece={retiring} onClose={() => setRetiring(null)} />
    </div>
  );
}
