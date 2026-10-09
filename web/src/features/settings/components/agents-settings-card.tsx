import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { AgentSettings } from '@/api/types';
import { QueryView } from '@/components/shared/query-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup, FieldSeparator } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgentSettings, useSaveAgentSettings } from '../api';
import { SettingSwitch } from './setting-switch';

export function AgentsSettingsCard() {
  const settings = useAgentSettings();
  const save = useSaveAgentSettings();
  const change = (patch: Partial<AgentSettings>) =>
    save.mutate(patch, {
      onSuccess: () => toast.success('Saved. This applies to new drafts.'),
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agents</CardTitle>
        <CardDescription>Helpers that review, score and predict your decision on each new draft.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryView query={settings} loading={<Skeleton className="h-28" />}>
          {(s) => (
            <FieldGroup>
              <SettingSwitch
                id="agents-enabled"
                label="Run agents on new drafts"
                description="The reviewer proposes fixes, the scorer rates the draft and the decision agent predicts what you will do."
                checked={s.agents_enabled}
                disabled={save.isPending}
                onChange={(v) => change({ agents_enabled: v })}
              />
              <FieldSeparator />
              <SettingSwitch
                id="show-recommendation"
                label="Show the prediction before I decide"
                description="Off by default. Seeing the prediction early can anchor your decision, which makes the agreement numbers meaningless."
                checked={s.show_recommendation}
                disabled={save.isPending || !s.agents_enabled}
                onChange={(v) => change({ show_recommendation: v })}
              />
            </FieldGroup>
          )}
        </QueryView>
      </CardContent>
    </Card>
  );
}
