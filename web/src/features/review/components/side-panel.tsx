import { useState } from 'react';
import type { DraftSentence, RunView } from '@/api/types';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { RunClaim } from '../lib/types';
import { AgentsPanel } from './agents-panel';
import { HistoryPanel } from './history-panel';
import { RehearsalPanel } from './rehearsal-panel';
import { SourcePanel } from './source-panel';

type Tab = 'source' | 'agents' | 'history' | 'audience';

interface SidePanelProps {
  run: RunView;
  claims: Map<string, RunClaim>;
  selected: DraftSentence | null;
  canRetryAgents: boolean;
  retryingAgents: boolean;
  onRetryAgents: () => void;
  onUseReviewer?: (posts: string[]) => void;
}

export function SidePanel({ run, claims, selected, canRetryAgents, retryingAgents, onRetryAgents, onUseReviewer }: SidePanelProps) {
  const [tab, setTab] = useState<Tab>('source');
  return (
    <Card className="gap-0 py-0 shadow-xs">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-0">
        <div className="border-b p-3">
          <TabsList className="w-full">
            <TabsTrigger value="source">Source</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="history">History{run.decisions.length > 0 && <span className="text-muted-foreground tabular-nums">{run.decisions.length}</span>}</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
          </TabsList>
        </div>
        <CardContent className="p-4">
          <TabsContent value="source">
            <SourcePanel source={run.source} claims={claims} selected={selected} />
          </TabsContent>
          <TabsContent value="agents">
            <AgentsPanel run={run} canRetry={canRetryAgents} retrying={retryingAgents} onRetry={onRetryAgents} onUseReviewer={onUseReviewer} />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel decisions={run.decisions} />
          </TabsContent>
          <TabsContent value="audience">
            <RehearsalPanel run={run} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
