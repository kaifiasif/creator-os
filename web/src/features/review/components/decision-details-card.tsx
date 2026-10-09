import { ChevronDownIcon } from 'lucide-react';
import type { RunView } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CONDITION } from '@/lib/labels';

type Versions = NonNullable<RunView['model_versions']>;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-mono text-xs break-all">{value}</dd>
    </div>
  );
}

const list = (record: Record<string, string> | null) => (record ? Object.entries(record).map(([k, v]) => `${k} ${v}`).join(', ') : 'Off');

/** Revealed only after a decision: which experiment arm this draft was in, and the exact models used. */
export function DecisionDetailsCard({ run }: { run: RunView }) {
  if (!run.condition) return null;
  const condition = CONDITION[run.condition];
  const v: Versions | null = run.model_versions;
  return (
    <Card className="gap-3 py-4 shadow-xs">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">Experiment: {condition.label.toLowerCase()}</CardTitle>
        <CardDescription>{condition.description}</CardDescription>
      </CardHeader>
      {v && (
        <CardContent className="px-4">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="group -ml-2 text-muted-foreground">
                <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" /> Model versions
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="grid gap-1.5 pt-2 text-sm">
                <Row label="Provider" value={v.llm} />
                <Row label="Drafting model" value={v.main} />
                <Row label="Checking model" value={v.judge} />
                <Row label="Embeddings" value={v.embeddings} />
                <Row label="Prompts" value={list(v.prompts)} />
                <Row label="Agents" value={list(v.agents)} />
              </dl>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}
    </Card>
  );
}
