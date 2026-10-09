import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AgentRun, TraceStep } from '../lib/types';

const brief = (value: unknown) => {
  if (value === undefined || value === null) return '';
  const text = JSON.stringify(value);
  return text === '{}' ? '' : text.length > 90 ? `${text.slice(0, 90)}…` : text;
};

function Step({ step }: { step: TraceStep }) {
  if (step.kind === 'tool') {
    return (
      <span>
        Called <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{step.tool}</code> <span className="break-all text-muted-foreground">{brief(step.input)}</span>
        {step.error ? <span className="text-unsupported"> It failed.</span> : null}
      </span>
    );
  }
  if (step.kind === 'thought') return <span className="text-muted-foreground">{step.text}</span>;
  if (step.kind === 'submit_rejected') return <span className="text-unsupported">Its answer was rejected: {String(step.error ?? 'invalid output')}</span>;
  return <span className="font-medium">Submitted its answer</span>;
}

/** The agent's tool calls and thoughts, collapsed by default. */
export function AgentTrace({ agent }: { agent: AgentRun }) {
  if (!agent.trace.length) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground">
          <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
          Show the agent's {plural(agent.trace.length, 'step')}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2 pt-1">
        <ol className="grid gap-1.5 border-l pl-3 text-xs">
          {agent.trace.map((step) => (
            <li key={step.step} className={cn('relative')}>
              <Step step={step} />
            </li>
          ))}
        </ol>
        <p className="text-xs text-muted-foreground">
          Model {agent.model}
          {agent.ms !== null ? `, took ${(agent.ms / 1000).toFixed(1)} s` : ''}.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
