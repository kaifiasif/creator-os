import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useArchiveActions } from '../api';
import type { Piece } from '../types';

/** Asks why an angle is done before retiring it. Closing without a reason changes nothing. */
export function RetireDialog({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const { retire } = useArchiveActions();
  const [reason, setReason] = useState('');

  const close = () => {
    setReason('');
    onClose();
  };
  const submit = () => {
    if (!piece || !reason.trim()) return;
    retire.mutate(
      { id: piece.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success('Angle retired. Drafts that say it again will be flagged.');
          close();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={piece !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retire this angle</DialogTitle>
          <DialogDescription>Drafts that say this again are flagged as a repeat. You can restore it later.</DialogDescription>
        </DialogHeader>
        {piece && <p className="line-clamp-4 rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-line">{piece.text}</p>}
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Field>
            <FieldLabel htmlFor="retire-reason">Why are you done with this angle?</FieldLabel>
            <Textarea id="retire-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="For example: I have said this too often" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!reason.trim() || retire.isPending}>
              {retire.isPending && <Spinner />} Retire angle
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
