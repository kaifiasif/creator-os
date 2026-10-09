import type { SourceDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';

const SAMPLE_LENGTH = 160;
const sample = (text: string) => (text.length > SAMPLE_LENGTH ? `${text.slice(0, SAMPLE_LENGTH).trimEnd()}…` : text);

/** One card per speaker with a sample of what they said. Picking one marks it as the creator. */
export function SpeakerPicker({ source, onPick, pending }: { source: SourceDetail; onPick: (speaker: string) => void; pending: boolean }) {
  const speakers = source.speakers ?? [];
  return (
    <ul className="grid gap-3 @2xl/main:grid-cols-2">
      {speakers.map((speaker) => {
        const turns = source.segments.filter((s) => s.speaker === speaker);
        const longest = [...turns].sort((a, b) => b.text.length - a.text.length)[0];
        const current = source.creator_speaker === speaker;
        return (
          <li key={speaker} className={cn('flex flex-col gap-3 rounded-lg border bg-card p-4', current && 'border-primary')}>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-full bg-muted text-xs font-semibold" aria-hidden>
                {speaker.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 font-medium">{speaker}</span>
              <span className="text-xs text-muted-foreground">{plural(turns.length, 'turn')}</span>
            </div>
            {longest && <blockquote className="flex-1 border-l-2 pl-3 text-sm text-muted-foreground">{sample(longest.text)}</blockquote>}
            <Button variant={current ? 'secondary' : 'outline'} size="sm" disabled={pending || current} onClick={() => onPick(speaker)} className="w-fit">
              {current ? 'Marked as you' : `I am ${speaker}`}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
