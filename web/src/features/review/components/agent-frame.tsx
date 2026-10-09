import type { LucideIcon } from 'lucide-react';
import { RotateCwIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { AgentEntry, AgentRun } from '../lib/types';
import { AgentTrace } from './agent-trace';

interface AgentFrameProps {
  icon: LucideIcon;
  title: string;
  agent: AgentEntry;
  hiddenText: string;
  onRetry?: () => void;
  children: (agent: AgentRun) => ReactNode;
}

const isRun = (a: AgentEntry): a is AgentRun => 'output' in a;

/** One agent's card: its running, failed and hidden states are the same for all three agents. */
export function AgentFrame({ icon: Icon, title, agent, hiddenText, onRetry, children }: AgentFrameProps) {
  return (
    <section className="grid gap-3 rounded-lg border p-3.5" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </h3>
        {agent.status === 'running' && <StatusBadge status={{ label: 'Working', tone: 'info', busy: true }} />}
        {agent.status === 'failed' && <StatusBadge status={{ label: 'Failed', tone: 'unsupported' }} />}
        {agent.status === 'hidden' && <StatusBadge status={{ label: 'Hidden for now', tone: 'neutral' }} />}
      </div>
      {agent.status === 'hidden' && <p className="text-sm text-muted-foreground">{hiddenText}</p>}
      {agent.status === 'running' && (
        <div className="grid gap-2" aria-busy>
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      )}
      {agent.status === 'failed' && isRun(agent) && (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">{agent.error ?? 'The agent stopped without an answer.'}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="w-fit" onClick={onRetry}>
              <RotateCwIcon /> Run agents again
            </Button>
          )}
        </div>
      )}
      {agent.status === 'done' && isRun(agent) && (
        <>
          {children(agent)}
          <AgentTrace agent={agent} />
        </>
      )}
    </section>
  );
}
