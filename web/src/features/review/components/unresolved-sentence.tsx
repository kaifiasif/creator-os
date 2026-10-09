import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { Resolution } from '../hooks/use-review-flow';
import type { UnresolvedSentence as Unresolved } from '../lib/types';

type Kind = Resolution['kind'];

const empty = (kind: Kind, text: string): Resolution => (kind === 'remove' ? { kind } : kind === 'edit' ? { kind, text } : { kind, reason: '' });

/** One refused sentence and the creator's choice for it: remove, rewrite, or keep with a reason. */
export function UnresolvedSentence({ sentence, reason, value, onChange, index }: { sentence: Unresolved; reason: string | null; value: Resolution | undefined; onChange: (r: Resolution) => void; index: number }) {
  return (
    <li className="grid gap-2.5 rounded-lg border p-3" data-testid="unresolved">
      <p className="text-sm">{sentence.text}</p>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={value?.kind ?? ''}
        onValueChange={(k) => k && onChange(empty(k as Kind, sentence.text))}
        aria-label={`What to do with sentence ${index + 1}`}
        className="flex-wrap"
      >
        <ToggleGroupItem value="remove">Remove it</ToggleGroupItem>
        <ToggleGroupItem value="edit">Edit it</ToggleGroupItem>
        <ToggleGroupItem value="keep">Keep with a reason</ToggleGroupItem>
      </ToggleGroup>
      {value?.kind === 'edit' && (
        <Textarea aria-label="New wording" value={value.text} onChange={(e) => onChange({ kind: 'edit', text: e.target.value })} className="min-h-16" autoFocus />
      )}
      {value?.kind === 'keep' && (
        <Input aria-label="Why keep it" value={value.reason} onChange={(e) => onChange({ kind: 'keep', reason: e.target.value })} placeholder="Why keep it, for example a deliberate callback" autoFocus />
      )}
    </li>
  );
}
