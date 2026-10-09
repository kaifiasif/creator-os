import type { Claim, SourceDetail } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatClock } from '@/lib/format';
import { cn } from '@/lib/utils';
import { transcriptParts } from './transcript-parts';

export const claimAnchor = (id: string) => `claim-${id}`;

interface TranscriptViewProps {
  source: SourceDetail;
  /** Claims to emphasise, for example the selected angle's. */
  emphasis?: ReadonlySet<string>;
  className?: string;
}

/** The transcript, with the creator's own lines in full colour and every claim quote marked in place. */
export function TranscriptView({ source, emphasis, className }: TranscriptViewProps) {
  const claims: Claim[] = source.claims;
  const creator = source.creator_speaker;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Transcript</CardTitle>
        <CardDescription>
          {claims.length ? 'Marked text is the exact quote each claim was taken from.' : 'Each turn as it was transcribed.'}
          {creator && source.speakers && source.speakers.length > 1 && ' Your lines are in full colour.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-4">
          {source.segments.map((segment) => {
            const mine = !creator || segment.speaker === creator;
            return (
              <li key={segment.id} className="grid gap-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn('font-medium', mine && 'text-foreground')}>{segment.speaker}</span>
                  {creator && segment.speaker === creator && source.speakers && source.speakers.length > 1 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      You
                    </Badge>
                  )}
                  {segment.start_ms !== null && <span className="tabular-nums">{formatClock(segment.start_ms)}</span>}
                </div>
                <p className={cn('text-sm leading-relaxed', mine ? 'text-foreground' : 'text-muted-foreground')}>
                  {transcriptParts(segment, claims).map((part, i) =>
                    part.claim ? (
                      <mark
                        key={i}
                        id={claimAnchor(part.claim.id)}
                        title={part.claim.text}
                        className={cn(
                          'scroll-mt-24 rounded-sm px-0.5 text-inherit',
                          emphasis?.has(part.claim.id) ? 'bg-primary/15 ring-1 ring-primary/40' : 'bg-muted-foreground/15',
                          part.claim.retired && 'line-through decoration-muted-foreground/60',
                        )}
                      >
                        {part.text}
                      </mark>
                    ) : (
                      <span key={i}>{part.text}</span>
                    ),
                  )}
                </p>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
