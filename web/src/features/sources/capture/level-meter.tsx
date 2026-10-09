import { cn } from '@/lib/utils';

/** The microphone's input level over the last couple of seconds. Purely a reading, so hidden from screen readers. */
export function LevelMeter({ levels, active }: { levels: number[]; active: boolean }) {
  return (
    <div className="flex h-14 w-full max-w-sm items-center justify-center gap-[3px]" aria-hidden>
      {levels.map((level, i) => (
        <span
          key={i}
          className={cn('w-1.5 rounded-full', active ? 'bg-foreground/70' : 'bg-muted-foreground/30')}
          style={{ height: `${Math.max(6, level * 100)}%` }}
        />
      ))}
    </div>
  );
}
