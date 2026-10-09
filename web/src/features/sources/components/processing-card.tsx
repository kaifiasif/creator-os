import { CheckIcon } from 'lucide-react';
import type { SourceDetail } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'transcribing', label: 'Transcribe', detail: 'Turning the recording or text into speaker turns.' },
  { key: 'extracting', label: 'Find claims', detail: 'Pulling out claims and checking each quote against the transcript, word for word.' },
] as const;

/** Background work in progress. The source query polls, so this page updates on its own. */
export function ProcessingCard({ status }: { status: SourceDetail['status'] }) {
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{current === 0 ? 'Transcribing' : 'Finding claims'}</CardTitle>
        <CardDescription>This page updates on its own. You can leave and come back.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-3" aria-live="polite">
          {STEPS.map((step, i) => (
            <li key={step.key} className={cn('flex items-start gap-3', i > current && 'text-muted-foreground')}>
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border">
                {i < current ? <CheckIcon className="size-3" aria-label="Done" /> : i === current ? <Spinner className="size-3" /> : null}
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{step.label}</span>
                <span className="text-sm text-muted-foreground">{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
