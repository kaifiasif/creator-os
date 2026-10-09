import { AlertCircleIcon, InfoIcon, RotateCwIcon, ShieldAlertIcon } from 'lucide-react';
import type { RunView } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { plural } from '@/lib/format';

interface ReviewAlertsProps {
  run: RunView;
  blocking: number;
  decided: boolean;
  retrying: boolean;
  onRetryChecks: () => void;
}

/** Notices about the draft as a whole: checks that failed, voice skipped or far off, flags to resolve. */
export function ReviewAlerts({ run, blocking, decided, retrying, onRetryChecks }: ReviewAlertsProps) {
  const draft = run.draft;
  if (!draft) return null;
  const voice = draft.voice && 'skipped' in draft.voice ? draft.voice : null;
  return (
    <>
      {draft.gate_status === 'gate_failed' && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>The checks could not run, so this draft cannot be accepted</AlertTitle>
          <AlertDescription>
            <p>{draft.gate_error ?? 'A check stopped before finishing.'} Run them again, or reject the draft.</p>
            {!decided && (
              <Button variant="outline" size="sm" className="mt-2" onClick={onRetryChecks} disabled={retrying}>
                {retrying ? <Spinner /> : <RotateCwIcon />} Run checks again
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {voice?.skipped && (
        <Alert>
          <InfoIcon />
          <AlertDescription>{voice.notice}</AlertDescription>
        </Alert>
      )}
      {voice && !voice.skipped && voice.beyond_p90 && (
        <Alert>
          <InfoIcon />
          <AlertDescription>As a whole, this reads further from your archive than 90% of your own posts.</AlertDescription>
        </Alert>
      )}
      {run.enforce_flags && blocking > 0 && (
        <Alert>
          <ShieldAlertIcon className="text-unsupported" />
          <AlertTitle>{plural(blocking, 'sentence')} {blocking === 1 ? 'blocks' : 'block'} accepting</AlertTitle>
          <AlertDescription>When you accept, you choose for each one: remove it, edit it, or keep it with a reason. Select a marked sentence to see why.</AlertDescription>
        </Alert>
      )}
    </>
  );
}
