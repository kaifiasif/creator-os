import { QuoteIcon } from 'lucide-react';
import type { ArchiveList } from '@/api/types';
import { CardStack } from '@/components/shared/motion/card-stack';
import { formatDate } from '@/lib/format';

/** A few of your live posts, shuffling on their own: a reminder of what every draft is compared with. */
export function ArchiveShuffle({ archive }: { archive: ArchiveList }) {
  const live = archive.pieces.filter((p) => !p.retired).slice(0, 6);
  if (live.length === 0) return null;
  const items = live.map((piece) => ({
    id: piece.id,
    label: piece.text,
    content: (
      <figure className="flex h-full flex-col justify-between gap-3">
        <blockquote className="line-clamp-4 text-[15px] leading-relaxed">
          <QuoteIcon aria-hidden className="mr-1.5 inline size-3.5 align-[-1px] text-muted-foreground" />
          {piece.text}
        </blockquote>
        <figcaption className="text-xs text-muted-foreground">{piece.published_at ? `Posted ${formatDate(piece.published_at)}` : 'Imported post'}</figcaption>
      </figure>
    ),
  }));
  return (
    <section aria-label="From your archive" className="grid items-center gap-6 rounded-xl border bg-muted/40 p-5 @3xl/main:grid-cols-[1fr_minmax(0,24rem)]">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">What every draft is checked against</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          {archive.total === 1 ? 'Your one live post is' : `Your ${archive.total} posts are`} the yardstick for repeats and voice. A draft too close to one of them is flagged before you see it.
        </p>
      </div>
      <CardStack items={items} mode="shuffle" height={176} />
    </section>
  );
}
