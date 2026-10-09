import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { plural } from '@/lib/format';
import type { PendingAccept, Resolution } from '../hooks/use-review-flow';
import { UnresolvedSentence } from './unresolved-sentence';

const valid = (r: Resolution | undefined, original: string) =>
  r !== undefined && (r.kind === 'remove' || (r.kind === 'edit' && r.text.trim() !== '' && r.text.trim() !== original) || (r.kind === 'keep' && r.reason.trim() !== ''));

interface UnresolvedFlagsDialogProps {
  pending: PendingAccept | null;
  busy: boolean;
  reasonFor: (sentenceId: string) => string | null;
  onCancel: () => void;
  onResolve: (resolutions: Record<string, Resolution>) => void;
}

/** Shown when the server refuses an accept because flagged sentences are still in the text. */
export function UnresolvedFlagsDialog({ pending, busy, reasonFor, onCancel, onResolve }: UnresolvedFlagsDialogProps) {
  const [choices, setChoices] = useState<Record<string, Resolution>>({});
  const list = pending?.unresolved ?? [];
  const ready = list.length > 0 && list.every((s) => valid(choices[s.sentence_id], s.text));
  const close = () => {
    setChoices({});
    onCancel();
  };
  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{list.length === 1 ? 'One flagged sentence is still in the draft' : `${plural(list.length, 'flagged sentence')} are still in the draft`}</DialogTitle>
          <DialogDescription>Under the checks you saw, a flagged sentence needs a decision before you accept. Each choice is saved with your results.</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3">
          {list.map((s, i) => (
            <UnresolvedSentence
              key={s.sentence_id}
              index={i}
              sentence={s}
              reason={reasonFor(s.sentence_id)}
              value={choices[s.sentence_id]}
              onChange={(r) => setChoices((c) => ({ ...c, [s.sentence_id]: r }))}
            />
          ))}
        </ol>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={() => onResolve(choices)}
            disabled={!ready || busy}
            data-testid="resolve-accept"
          >
            {busy && <Spinner />} Accept with these choices
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
