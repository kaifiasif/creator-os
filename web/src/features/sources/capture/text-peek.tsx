import { UsersIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { plural } from '@/lib/format';
import type { Sniff } from './sniff';

/** Who seems to be speaking in a text transcript, and its first lines. */
export function TextPeek({ sniff }: { sniff: Sniff }) {
  return (
    <div className="grid gap-2">
      {sniff.speakers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <UsersIcon className="size-3.5" aria-hidden />
          <span className="sr-only">Speakers found:</span>
          {sniff.speakers.map((speaker) => (
            <Badge key={speaker.name} variant="secondary" className="font-normal">
              {speaker.name}
              <span className="text-muted-foreground">{plural(speaker.lines, 'line')}</span>
            </Badge>
          ))}
        </div>
      )}
      <div className="rounded-md bg-muted px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        {sniff.preview.map((line, i) => (
          <p key={i} className="truncate">
            {line}
          </p>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{plural(sniff.words, 'word')}</p>
    </div>
  );
}
