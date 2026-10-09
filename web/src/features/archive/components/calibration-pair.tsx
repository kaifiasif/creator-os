import { formatDate } from '@/lib/format';
import type { CalibrationPair as Pair } from '../types';

function PairPost({ label, piece }: { label: string; piece: Pair['piece_a'] }) {
  return (
    <figure className="grid content-start gap-2 rounded-lg border bg-muted/40 p-4">
      <figcaption className="text-xs text-muted-foreground">
        {label}, {formatDate(piece.published_at)}
      </figcaption>
      <blockquote className="line-clamp-[8] text-sm leading-relaxed whitespace-pre-line">{piece.text}</blockquote>
    </figure>
  );
}

/** Two of the creator's own posts side by side, so they can say whether they make the same point. */
export function CalibrationPair({ pair }: { pair: Pair }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <PairPost label="First post" piece={pair.piece_a} />
      <PairPost label="Second post" piece={pair.piece_b} />
    </div>
  );
}
