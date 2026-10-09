import { ArchiveIcon, MoreVerticalIcon, Undo2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useArchiveActions } from '../api';
import type { Piece } from '../types';

export function PieceActions({ piece, onRetire }: { piece: Piece; onRetire: (piece: Piece) => void }) {
  const { unretire } = useArchiveActions();
  const restore = () =>
    unretire.mutate(piece.id, {
      onSuccess: () => toast.success('Angle restored. Drafts can use it again.'),
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Actions for this post">
          <MoreVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {piece.retired ? (
          <DropdownMenuItem onSelect={restore} disabled={unretire.isPending}>
            <Undo2Icon /> Restore angle
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onRetire(piece)}>
            <ArchiveIcon /> Retire angle
          </DropdownMenuItem>
        )}
        {piece.url && (
          <DropdownMenuItem asChild>
            <a href={piece.url} target="_blank" rel="noopener noreferrer">
              Open on X
            </a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
