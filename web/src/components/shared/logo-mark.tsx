import { cn } from '@/lib/utils';

/** Three lines of decreasing length: a draft being cut down to what is really yours. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground', className)}>
      <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
        <path d="M3 4.5h10M3 8h7M3 11.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
