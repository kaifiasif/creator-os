import { AlertCircleIcon, RotateCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { SourceDetail } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSourceActions } from '../api';
import { PasteTranscriptDialog } from './paste-transcript-dialog';

export function FailedState({ source }: { source: SourceDetail }) {
  const { retry } = useSourceActions(source.id);
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>This source could not be processed</AlertTitle>
      <AlertDescription>
        <p>{source.error ?? 'Something went wrong while processing it.'}</p>
        <p>Retry to run the failed step again, or paste the transcript yourself.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}>
            {retry.isPending ? <Spinner /> : <RotateCwIcon />} Retry
          </Button>
          <PasteTranscriptDialog id={source.id} />
        </div>
      </AlertDescription>
    </Alert>
  );
}
