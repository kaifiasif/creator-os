import { AlertCircleIcon, RotateCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { RunView } from '@/api/types';
import { QueryView } from '@/components/shared/query-view';
import { StatusBadge } from '@/components/shared/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { REHEARSAL_ACTIVE, REHEARSAL_STATUS } from '@/lib/labels';
import { useRehearsal, useRehearsalActions, useRehearsalConfig } from '../rehearsal-api';
import { RehearsalInterview } from './rehearsal-interview';
import { RehearsalResults } from './rehearsal-results';
import { RehearsalStart } from './rehearsal-start';

const Note = ({ children }: { children: string }) => <p className="text-sm text-muted-foreground">{children}</p>;

/** Audience tab: simulate how followers react to the decided draft. */
export function RehearsalPanel({ run }: { run: RunView }) {
  const config = useRehearsalConfig();
  const state = useRehearsal(run.run_id);
  const actions = useRehearsalActions(run.run_id);
  const latest = run.decisions.at(-1);

  const start = (input: { audience?: string; force?: boolean }) =>
    actions.start.mutate(input, { onError: (e) => toast.error(errorMessage(e)) });

  return (
    <QueryView query={state} loading={<Skeleton className="h-24" />}>
      {({ enabled, before_decision, rehearsal }) => {
        if (!enabled) return <Note>Audience rehearsal is turned off on this server.</Note>;
        if (!latest && !before_decision) return <Note>Rehearsal opens after you decide, so simulated reactions can't sway your decision.</Note>;
        if (latest?.decision === 'reject') return <Note>You rejected this draft, so there's nothing to rehearse.</Note>;

        if (!rehearsal || rehearsal.status === 'failed') {
          return (
            <div className="grid gap-3">
              {rehearsal?.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircleIcon />
                  <AlertTitle>The rehearsal stopped</AlertTitle>
                  <AlertDescription>{rehearsal.error ?? 'No reason was given.'}</AlertDescription>
                </Alert>
              )}
              <RehearsalStart offline={config.data?.engine === 'swarm-offline'} pending={actions.start.isPending} retry={Boolean(rehearsal)} onStart={(audience) => start({ audience, force: Boolean(rehearsal) })} />
            </div>
          );
        }

        if (REHEARSAL_ACTIVE.has(rehearsal.status)) {
          return (
            <div className="grid gap-3" aria-busy>
              <div className="flex items-center justify-between gap-2">
                <StatusBadge status={REHEARSAL_STATUS[rehearsal.status]} />
                <span className="text-sm text-muted-foreground tabular-nums">{rehearsal.progress}%</span>
              </div>
              <Progress value={rehearsal.progress} aria-label="Rehearsal progress" />
              <Note>Free-tier models can take a minute or two.</Note>
            </div>
          );
        }

        const result = rehearsal.result;
        if (!result) return <Note>This rehearsal finished without results.</Note>;
        return (
          <div className="grid gap-4">
            <RehearsalResults result={result} />
            {config.data?.interviews && result.engine !== 'swarm-offline' && (
              <RehearsalInterview rehearsal={rehearsal} personas={result.personas ?? []} mutation={actions.interview} />
            )}
            <Button variant="ghost" size="sm" className="w-fit" disabled={actions.start.isPending} onClick={() => start({ audience: rehearsal.settings.audience ?? undefined, force: true })}>
              {actions.start.isPending ? <Spinner /> : <RotateCwIcon />} Rehearse again
            </Button>
          </div>
        );
      }}
    </QueryView>
  );
}
