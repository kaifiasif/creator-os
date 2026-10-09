import { BotIcon, GaugeIcon, RotateCwIcon, ScaleIcon } from 'lucide-react';
import type { DecisionPrediction, ReviewOutput, RunView, ScoreOutput } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AGENT } from '@/lib/labels';
import { AgentFrame } from './agent-frame';
import { DecisionCard } from './decision-card';
import { ReviewerCard } from './reviewer-card';
import { ScorerCard } from './scorer-card';

interface AgentsPanelProps {
  run: RunView;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
  onUseReviewer?: (posts: string[]) => void;
}

const HIDDEN_BEFORE_DECISION = 'Agent notes for this draft appear after you decide, so they cannot reveal the hidden checks.';

export function AgentsPanel({ run, canRetry, retrying, onRetry, onUseReviewer }: AgentsPanelProps) {
  const { reviewer, scorer, decision } = run.agents;
  const any = reviewer || scorer || decision;
  const sentenceText = new Map(run.draft?.posts.flatMap((p) => p.sentences).map((s) => [s.id, s.text]) ?? []);
  const allHidden = [reviewer, scorer, decision].every((a) => !a || a.status === 'hidden');
  const retry = canRetry ? onRetry : undefined;

  if (!any) {
    return (
      <div className="grid gap-3 text-sm text-muted-foreground">
        <p>{run.agent_settings.agents_enabled ? 'The agents have not run on this draft.' : 'The agents are turned off. Turn them on in Settings.'}</p>
        {run.agent_settings.agents_enabled && canRetry && (
          <Button variant="outline" size="sm" className="w-fit" onClick={onRetry} disabled={retrying}>
            {retrying ? <Spinner /> : <RotateCwIcon />} Run agents
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {reviewer && (
        <AgentFrame icon={BotIcon} title={AGENT.reviewer} agent={reviewer} hiddenText={HIDDEN_BEFORE_DECISION} onRetry={retry}>
          {(a) => <ReviewerCard output={a.output as unknown as ReviewOutput} sentenceText={sentenceText} onUse={onUseReviewer} />}
        </AgentFrame>
      )}
      {scorer && (
        <AgentFrame icon={GaugeIcon} title={AGENT.scorer} agent={scorer} hiddenText={HIDDEN_BEFORE_DECISION} onRetry={retry}>
          {(a) => <ScorerCard output={a.output as unknown as ScoreOutput} />}
        </AgentFrame>
      )}
      {decision && (
        <AgentFrame
          icon={ScaleIcon}
          title={AGENT.decision}
          agent={decision}
          hiddenText="Its prediction appears after you decide, so it cannot sway you. Your choice is compared with it in Results."
          onRetry={retry}
        >
          {(a) => <DecisionCard output={a.output as unknown as DecisionPrediction} first={run.decisions[0] ?? null} />}
        </AgentFrame>
      )}
      {canRetry && !allHidden && (
        <Button variant="ghost" size="sm" className="w-fit" onClick={onRetry} disabled={retrying}>
          {retrying ? <Spinner /> : <RotateCwIcon />} Run agents again
        </Button>
      )}
    </div>
  );
}
