import { Badge } from '@/components/ui/badge';
import type { Piece } from '../types';

export function PieceBadges({ piece }: { piece: Piece }) {
  const parts = piece.parts?.length ?? 0;
  if (!parts && !piece.is_holdout && !piece.retired) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {parts > 1 && <Badge variant="outline">Thread of {parts}</Badge>}
      {piece.is_holdout && <Badge variant="outline">Held out</Badge>}
      {piece.retired && <Badge variant="secondary">Retired</Badge>}
    </div>
  );
}
