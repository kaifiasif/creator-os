import { ArchiveIcon, LocateIcon } from 'lucide-react';
import { useState } from 'react';
import type { Claim, SourceDetail } from '@/api/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ExtractionLog } from './extraction-log';
import { RetireClaimDialog } from './retire-claim-dialog';

function ClaimItem({ claim, onLocate, onRetire }: { claim: Claim; onLocate: () => void; onRetire: () => void }) {
  return (
    <li className={cn('grid gap-2 px-4 py-3', claim.retired && 'text-muted-foreground')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={claim.is_creator ? 'outline' : 'secondary'}>{claim.is_creator ? 'You' : claim.speaker}</Badge>
        {claim.retired && <Badge variant="outline">Retired</Badge>}
      </div>
      <p className="text-sm leading-snug font-medium">{claim.text}</p>
      <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">{claim.quote}</blockquote>
      <div className="flex flex-wrap gap-1">
        <Button variant="ghost" size="xs" onClick={onLocate}>
          <LocateIcon /> Show in transcript
        </Button>
        {claim.is_creator && !claim.retired && (
          <Button variant="ghost" size="xs" onClick={onRetire}>
            <ArchiveIcon /> Retire
          </Button>
        )}
      </div>
    </li>
  );
}

export function ClaimsPanel({ source, onLocate }: { source: SourceDetail; onLocate: (claimId: string) => void }) {
  const [retiring, setRetiring] = useState<Claim | null>(null);
  const mine = source.claims.filter((c) => c.is_creator).length;
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {plural(source.claims.length, 'claim')}, {mine} of them yours. Each quote was found word for word in the transcript.
      </p>
      <ul className="divide-y rounded-md border">
        {source.claims.map((claim) => (
          <ClaimItem key={claim.id} claim={claim} onLocate={() => onLocate(claim.id)} onRetire={() => setRetiring(claim)} />
        ))}
      </ul>
      {source.extraction_log && <ExtractionLog log={source.extraction_log} />}
      <RetireClaimDialog sourceId={source.id} claim={retiring} onClose={() => setRetiring(null)} />
    </div>
  );
}
