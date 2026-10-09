import { HistoryIcon, SparklesIcon } from 'lucide-react';
import type { Angle } from '@/api/types';
import { TONE_DOT } from '@/components/shared/tone';
import { Badge } from '@/components/ui/badge';
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from '@/components/ui/field';
import { Kbd } from '@/components/ui/kbd';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { formatDate, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';

function ClosestPost({ closest }: { closest: Angle['closest_archive'] }) {
  if (!closest) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <SparklesIcon className="size-3.5" aria-hidden /> Nothing like this in your archive yet
      </p>
    );
  }
  return (
    <div className="grid gap-1 border-t pt-2 text-xs text-muted-foreground">
      <p className="flex items-center gap-1.5">
        <HistoryIcon className="size-3.5" aria-hidden />
        {`Closest earlier post, ${formatPercent(closest.similarity)} similar${closest.published_at ? `, ${formatDate(closest.published_at)}` : ''}`}
      </p>
      <p className="line-clamp-2">“{closest.text}”</p>
    </div>
  );
}

/** One proposed angle as a selectable card: what leads, why, and how close it is to past posts. */
export function AngleCard({ angle, index }: { angle: Angle; index: number }) {
  const id = `angle-${angle.id}`;
  return (
    <FieldLabel htmlFor={id} className="lift">
      <Field orientation="horizontal" className="items-start">
        <FieldContent className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Kbd aria-hidden>{index + 1}</Kbd>
            {angle.retired_match && (
              <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                <span aria-hidden className={cn('size-1.5 rounded-full', TONE_DOT.repeat)} />
                Close to an angle you retired
              </Badge>
            )}
          </div>
          <FieldTitle className="leading-snug">{angle.lead_claim?.text ?? 'Lead claim missing'}</FieldTitle>
          <FieldDescription>{angle.rationale}</FieldDescription>
          <ClosestPost closest={angle.closest_archive} />
        </FieldContent>
        <RadioGroupItem value={angle.id} id={id} aria-label={`Angle ${index + 1}`} />
      </Field>
    </FieldLabel>
  );
}
