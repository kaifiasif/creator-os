import type { RunClaim } from '../lib/types';
import { DetailSection } from './detail-section';

export function CitedClaims({ claims }: { claims: RunClaim[] }) {
  return (
    <DetailSection title={claims.length === 1 ? 'Cited quote' : 'Cited quotes'}>
      {claims.length === 0 && <p>This sentence cites nothing from the source.</p>}
      {claims.map((c) => (
        <figure key={c.id} className="grid gap-1 border-l-2 pl-3">
          <blockquote className="text-foreground italic">{c.quote}</blockquote>
          <figcaption className="text-xs">{c.is_creator ? 'You said' : `${c.speaker} said`}</figcaption>
        </figure>
      ))}
    </DetailSection>
  );
}
