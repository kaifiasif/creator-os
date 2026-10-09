import type { ReactNode } from 'react';
import { TONE_DOT } from '@/components/shared/tone';
import type { Tone } from '@/lib/labels';
import { cn } from '@/lib/utils';

/** A titled block in the sentence detail, with an optional proof-colour dot. */
export function DetailSection({ title, tone, children }: { title: string; tone?: Tone; children: ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        {tone && <span aria-hidden className={cn('size-2 rounded-full', TONE_DOT[tone])} />}
        {title}
      </h3>
      <div className="grid gap-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}
