import { AlertCircleIcon, RotateCwIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export function RunFailedState({ error, busy, onRetry }: { error: string | null; busy: boolean; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="mx-auto max-w-2xl">
      <AlertCircleIcon />
      <AlertTitle>The draft could not be written</AlertTitle>
      <AlertDescription>
        <p>{error ?? 'Drafting stopped before it finished.'} Try again; if it keeps failing, check the server log.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry} disabled={busy}>
          {busy ? <Spinner /> : <RotateCwIcon />} Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
