import { LockIcon } from 'lucide-react';
import { hrefOf } from '@/app/router';
import type { Acceptance } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { plural } from '@/lib/format';

type Locked = Extract<Acceptance, { locked: true }>;

/** While drafts wait for a first decision, the numbers stay hidden so they cannot sway that decision. */
export function LockedNotice({ locked }: { locked: Locked }) {
  return (
    <Alert className="max-w-2xl">
      <LockIcon />
      <AlertTitle>Decide on {plural(locked.pending_runs.length, 'draft')} first</AlertTitle>
      <AlertDescription>
        <p>{locked.reason}</p>
        <ul className="mt-2 grid gap-1">
          {locked.pending_runs.map((run) => (
            <li key={run.id}>
              <a href={hrefOf({ name: 'review', id: run.id })} className="font-medium text-foreground underline underline-offset-4">
                {run.title}
              </a>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
