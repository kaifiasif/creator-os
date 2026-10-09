import type { DraftSentence } from '@/api/types';
import { SOURCE_KIND } from '@/lib/labels';
import { plural } from '@/lib/format';
import type { RunClaim, RunSource } from '../lib/types';
import { Transcript } from './transcript';

export function SourcePanel({ source, claims, selected }: { source: RunSource | null; claims: Map<string, RunClaim>; selected: DraftSentence | null }) {
  if (!source) return <p className="text-sm text-muted-foreground">The source for this draft no longer exists.</p>;
  const cited = selected?.supports.flatMap((id) => claims.get(id) ?? []) ?? [];
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <a href={`#/sources/${source.id}`} className="font-medium underline-offset-4 hover:underline">
          {source.title}
        </a>
        <span className="text-xs text-muted-foreground">{SOURCE_KIND[source.kind]}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {!selected ? 'Select a sentence to highlight the words it came from.' : cited.length ? `Highlighting ${plural(cited.length, 'cited quote')}.` : 'The selected sentence cites nothing from the source.'}
      </p>
      {source.transcript_text ? <Transcript source={source} cited={cited} /> : <p className="text-sm text-muted-foreground">This source has no transcript.</p>}
    </div>
  );
}
