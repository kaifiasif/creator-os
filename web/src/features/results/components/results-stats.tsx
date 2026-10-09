import type { AcceptanceOpen } from '@/api/types';
import { StatCard, StatGrid } from '@/components/shared/stat-card';
import { Badge } from '@/components/ui/badge';
import { formatPercent, plural } from '@/lib/format';
import { rateFootnote } from '../format-rate';

/** Light-edit points between the two conditions. The study's target is 15 or more. */
function difference(a: AcceptanceOpen) {
  const { gate, context_only } = a.by_condition;
  if (gate.rate === null || context_only.rate === null) return null;
  return Math.round((gate.rate - context_only.rate) * 100);
}

export function ResultsStats({ acceptance: a }: { acceptance: AcceptanceOpen }) {
  const { gate, context_only } = a.by_condition;
  const diff = difference(a);
  const agent = a.agents.decision;
  return (
    <StatGrid>
      <StatCard
        label="Light edits with checks"
        value={formatPercent(gate.rate)}
        badge={diff !== null && <Badge variant="outline">{diff > 0 ? `+${diff}` : diff} points</Badge>}
        footnote={rateFootnote({ ...gate, k: gate.light_edit })}
      />
      <StatCard label="Light edits without checks" value={formatPercent(context_only.rate)} footnote={rateFootnote({ ...context_only, k: context_only.light_edit })} />
      <StatCard label="Decision agent agreement" value={formatPercent(agent.rate)} footnote={rateFootnote({ ...agent, k: agent.agree })} />
      <StatCard
        label="Rejected drafts"
        value={a.rejections.total}
        footnote={`Out of ${plural(a.runs, 'decided run')}, ${a.rejections.fixed} fixed afterwards`}
      />
    </StatGrid>
  );
}
