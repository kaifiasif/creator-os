import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import type { StatusLabel } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { TONE_DOT } from './tone';

/** An outline badge with a coloured dot, or a spinner while background work runs. */
export function StatusBadge({ status, className }: { status: StatusLabel; className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 text-muted-foreground', className)}>
      {status.busy ? <Spinner className="size-3" /> : <span key={status.tone} aria-hidden className={cn('motion-pop size-1.5 rounded-full', TONE_DOT[status.tone])} />}
      {status.label}
    </Badge>
  );
}
