import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPercent } from '@/lib/format';
import { CONDITION } from '@/lib/labels';
import type { AgentStats } from '../types';
import { ConfusionTable } from './confusion-table';
import { MetricList } from './metric-list';

const score = (x: number | null) => (x === null ? 'n/a' : x.toFixed(1));

export function AgentsCard({ agents }: { agents: AgentStats }) {
  const { decision, reviewer, scorer } = agents;
  return (
    <Card className="@3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>How the decision agent, reviewer and scorer line up with what you actually did.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 @3xl/main:grid-cols-2">
        <section className="grid content-start gap-3">
          <h3 className="text-sm font-medium">Decision agent</h3>
          <ConfusionTable counts={decision.confusion} />
          <MetricList
            rows={[
              { label: `Agreement when ${CONDITION.gate.label.toLowerCase()}`, value: formatPercent(decision.by_condition.gate.rate) },
              { label: `Agreement when ${CONDITION.context_only.label.toLowerCase()}`, value: formatPercent(decision.by_condition.context_only.rate) },
            ]}
          />
        </section>
        <div className="grid content-start gap-6">
          <section className="grid gap-3">
            <h3 className="text-sm font-medium">Reviewer</h3>
            <MetricList
              rows={[
                { label: 'Drafts with proposed fixes', value: reviewer.runs_with_fixes },
                { label: "Started from the reviewer's version", value: reviewer.used },
                { label: 'Light-edit rate when used', value: formatPercent(reviewer.light_rate_when_used) },
                { label: 'Light-edit rate when not used', value: formatPercent(reviewer.light_rate_when_not_used) },
              ]}
            />
          </section>
          <section className="grid gap-3">
            <h3 className="text-sm font-medium">Scorer</h3>
            <MetricList
              rows={[
                { label: 'Mean score, light edits', value: score(scorer.mean_overall_light_accept) },
                { label: 'Mean score, everything else', value: score(scorer.mean_overall_other) },
              ]}
            />
            <p className="text-xs text-muted-foreground">If the score does not separate drafts you accept lightly from the rest, it is not measuring what matters to you.</p>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
