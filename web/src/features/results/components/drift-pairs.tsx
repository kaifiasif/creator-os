import { formatDate, formatPercent } from '@/lib/format';
import type { DriftPair } from '../types';

/** A recent output next to the closest thing you wrote yourself. Would you have written the first one? */
export function DriftPairs({ pairs }: { pairs: DriftPair[] }) {
  if (!pairs.length) return null;
  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-medium">Recent outputs next to your closest post</h3>
      {pairs.map((pair, i) => (
        <div key={i} className="grid overflow-hidden rounded-lg border md:grid-cols-2 md:divide-x">
          <figure className="grid content-start gap-1 border-b bg-muted/40 p-3 md:border-b-0">
            <figcaption className="text-xs text-muted-foreground">Output</figcaption>
            <p className="line-clamp-6 text-sm whitespace-pre-line">{pair.output}</p>
          </figure>
          <figure className="grid content-start gap-1 p-3">
            <figcaption className="text-xs text-muted-foreground">
              {pair.archive ? `Your post from ${formatDate(pair.archive.published_at)}, ${formatPercent(pair.archive.similarity)} similar` : 'No archive post to compare'}
            </figcaption>
            {pair.archive && <p className="line-clamp-6 text-sm whitespace-pre-line">{pair.archive.text}</p>}
          </figure>
        </div>
      ))}
    </div>
  );
}
