import type { ScoreOutput } from '@/api/types';
import { Progress } from '@/components/ui/progress';
import { SCORE_DIMENSION } from '@/lib/labels';

const ORDER = ['traceability', 'novelty', 'voice_fit', 'hook', 'clarity'];

/** Overall score and the five dimensions; each says whether a rule measured it or the model judged it. */
export function ScorerCard({ output }: { output: ScoreOutput }) {
  const dims = Object.entries(output.dimensions).sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return (
    <div className="grid gap-4">
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-semibold tabular-nums">{output.overall}</span>
        <span className="text-sm text-muted-foreground">out of 5</span>
      </div>
      {output.comment && <p className="text-sm text-muted-foreground">{output.comment}</p>}
      <ul className="grid gap-3">
        {dims.map(([key, d]) => (
          <li key={key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">{SCORE_DIMENSION[key] ?? key}</span>
              <span className="tabular-nums">{d.score}</span>
            </div>
            <Progress value={(d.score / 5) * 100} aria-label={`${SCORE_DIMENSION[key] ?? key}: ${d.score} out of 5`} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              {d.by === 'rule' ? 'Measured by a rule.' : 'Judged by the model.'} {d.reason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
