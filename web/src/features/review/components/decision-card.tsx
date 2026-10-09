import type { DecisionPrediction } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatPercent } from '@/lib/format';
import { RECOMMENDATION, REJECT_REASON } from '@/lib/labels';
import type { Decision } from '../lib/types';

const asPrediction = (d: Decision['decision']) => (d === 'reject' ? 'reject' : d === 'accept' ? 'accept' : 'edit');

/** The Decision agent's prediction. Only rendered when the server lets the creator see it. */
export function DecisionCard({ output, first }: { output: DecisionPrediction; first: Decision | null }) {
  const yours = first ? asPrediction(first.decision) : null;
  return (
    <div className="grid gap-2">
      <p className="text-base font-semibold">{RECOMMENDATION[output.recommendation]}</p>
      {output.reject_reason && <p className="text-sm text-muted-foreground">{REJECT_REASON[output.reject_reason]}</p>}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Progress value={output.confidence * 100} className="h-1.5 w-24" aria-label="Confidence" />
        {formatPercent(output.confidence)} confident
      </div>
      <p className="text-sm text-muted-foreground">{output.rationale}</p>
      {yours ? (
        <Badge variant="outline">{yours === output.recommendation ? 'Matches your decision' : `You chose: ${RECOMMENDATION[yours]}`}</Badge>
      ) : (
        <p className="text-xs text-muted-foreground">A prediction only. You decide.</p>
      )}
    </div>
  );
}
