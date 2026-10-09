import { X_LIMIT, xLength } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Characters as X counts them, against the 280 limit. Over the limit is a failed X rule. */
export function CharCount({ text, className }: { text: string; className?: string }) {
  const n = xLength(text);
  const over = n > X_LIMIT;
  return (
    <span className={cn('text-xs tabular-nums', over ? 'font-medium text-unsupported' : 'text-muted-foreground', className)} aria-label={`${n} of ${X_LIMIT} characters`}>
      {n}/{X_LIMIT}
    </span>
  );
}
