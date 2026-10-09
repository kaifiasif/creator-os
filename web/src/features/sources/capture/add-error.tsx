import { AlertCircleIcon } from 'lucide-react';
import { errorMessage, isApiError } from '@/api/errors';
import { hrefOf } from '@/app/router';
import { closeOverlay } from '@/app/ui-state';
import { cn } from '@/lib/utils';

/** The id of the source this material was already added as, when the server says it is a duplicate. */
export function existingSourceId(error: unknown): string | null {
  if (!isApiError(error, 'DUPLICATE_SOURCE')) return null;
  const id = error.details?.existing_source_item_id;
  return typeof id === 'string' ? id : null;
}

/** Why adding a source failed, with a link to the original when it is a duplicate. */
export function AddError({ error, className }: { error: unknown; className?: string }) {
  const existing = existingSourceId(error);
  return (
    <p role="alert" className={cn('flex items-start gap-2 text-sm text-destructive', className)}>
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {errorMessage(error)}{' '}
        {existing && (
          <a href={hrefOf({ name: 'source', id: existing })} onClick={closeOverlay} className="font-medium text-foreground underline underline-offset-4">
            Open the existing source
          </a>
        )}
      </span>
    </p>
  );
}
