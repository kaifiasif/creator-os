import { useEffect, useRef, type ReactNode } from 'react';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RunClaim, RunSource } from '../lib/types';

type Range = Pick<RunClaim, 'id' | 'char_start' | 'char_end'>;

/** Splits text[start, end) into plain runs and highlighted runs for the cited ranges. */
function highlight(text: string, start: number, end: number, ranges: Range[]): ReactNode[] {
  const parts: ReactNode[] = [];
  let at = start;
  for (const r of ranges) {
    const from = Math.max(r.char_start, at);
    const to = Math.min(r.char_end, end);
    if (to <= from) continue;
    if (from > at) parts.push(text.slice(at, from));
    parts.push(
      <mark key={`${r.id}-${from}`} data-cite className="rounded-sm bg-primary/10 px-0.5 text-foreground ring-1 ring-primary/25">
        {text.slice(from, to)}
      </mark>,
    );
    at = to;
  }
  if (at < end) parts.push(text.slice(at, end));
  return parts;
}

/** The source transcript by speaker, with the selected sentence's cited quotes highlighted. */
export function Transcript({ source, cited }: { source: RunSource; cited: RunClaim[] }) {
  const box = useRef<HTMLDivElement>(null);
  const text = source.transcript_text ?? '';
  const ranges = [...cited].sort((a, b) => a.char_start - b.char_start);
  const key = ranges.map((r) => r.id).join();

  useEffect(() => {
    const el = box.current;
    const mark = el?.querySelector<HTMLElement>('mark[data-cite]');
    if (el && mark) el.scrollTo({ top: mark.offsetTop - el.clientHeight / 3, behavior: 'smooth' });
  }, [key]);

  const segments = source.segments.length ? source.segments : [{ id: 'all', speaker: '', start_ms: null, char_start: 0, char_end: text.length }];
  return (
    <div ref={box} className="relative grid max-h-[28rem] gap-3 overflow-y-auto pr-1 lg:max-h-[calc(100svh-22rem)]">
      {segments.map((seg) => {
        const inside = ranges.filter((r) => r.char_end > seg.char_start && r.char_start < seg.char_end);
        return (
          <div key={seg.id} className={cn('grid gap-0.5 transition-opacity', ranges.length > 0 && inside.length === 0 && 'opacity-50')}>
            {seg.speaker && (
              <div className="flex items-baseline gap-2 text-xs">
                <span className={cn('font-medium', seg.speaker === source.creator_speaker ? 'text-foreground' : 'text-muted-foreground')}>
                  {seg.speaker === source.creator_speaker ? 'You' : seg.speaker}
                </span>
                {seg.start_ms !== null && <span className="text-muted-foreground tabular-nums">{formatClock(seg.start_ms)}</span>}
              </div>
            )}
            <p className="text-sm leading-relaxed">{highlight(text, seg.char_start, seg.char_end, inside)}</p>
          </div>
        );
      })}
    </div>
  );
}
