import type { DraftSentence } from '@/api/types';
import { TONE_DOT } from '@/components/shared/tone';
import { plural } from '@/lib/format';
import { PROBLEM } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { hasChecks, type Problem, problemsOf } from '../lib/checks';

const ORDER: Problem[] = ['unsupported', 'partial', 'repeat'];

/** A one-line count of what the checks found, with the proof colours as a legend. */
export function ProofSummary({ sentences }: { sentences: DraftSentence[] }) {
  const checked = sentences.filter((s) => hasChecks(s.checks));
  if (!checked.length) return null;
  const counts = ORDER.map((p) => ({ p, n: checked.filter((s) => hasChecks(s.checks) && problemsOf(s.checks).includes(p)).length }));
  const flagged = checked.filter((s) => hasChecks(s.checks) && problemsOf(s.checks).length > 0).length;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span className="font-medium">
        {flagged ? `${flagged} of ${plural(checked.length, 'sentence')} ${flagged === 1 ? 'needs' : 'need'} a look` : `All ${plural(checked.length, 'sentence')} check out`}
      </span>
      {counts
        .filter((c) => c.n > 0)
        .map((c) => (
          <span key={c.p} className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden className={cn('size-2 rounded-full', TONE_DOT[c.p])} />
            {PROBLEM[c.p].label} {c.n}
          </span>
        ))}
    </div>
  );
}
