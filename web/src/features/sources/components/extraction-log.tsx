import { ChevronDownIcon } from 'lucide-react';
import type { SourceDetail } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { plural } from '@/lib/format';

type Log = NonNullable<SourceDetail['extraction_log']>;

/** Plain-language versions of the server's drop reasons (free text, not an enum). */
const DROP_REASON: Record<string, string> = {
  'quote not found verbatim in segment': 'The quote was not found word for word in the transcript.',
  'segment does not exist': 'The quote pointed at a part of the transcript that does not exist.',
  'offset check failed': 'The quote did not match the transcript at its position.',
};

/** What extraction found, kept and dropped, so nothing disappears silently. */
export function ExtractionLog({ log }: { log: Log }) {
  return (
    <Collapsible className="grid gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm">
          <p className="font-medium">How claims were checked</p>
          <p className="text-muted-foreground">
            {plural(log.extracted, 'candidate')} found, {log.kept} kept, {plural(log.dropped.length, 'quote')} dropped
          </p>
        </div>
        {log.dropped.length > 0 && (
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="group">
              Dropped quotes <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
        )}
      </div>
      <CollapsibleContent>
        <ul className="grid gap-2 pt-1">
          {log.dropped.map((d, i) => (
            <li key={i} className="grid gap-0.5 border-l-2 pl-3 text-sm">
              <p>“{d.quote}”</p>
              <p className="text-xs text-muted-foreground">{DROP_REASON[d.reason] ?? d.reason}</p>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
