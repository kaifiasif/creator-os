import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Claim } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useSourceActions } from '../api';

/** Retiring a claim tells future drafts not to say it again. The reason is required. */
export function RetireClaimDialog({ sourceId, claim, onClose }: { sourceId: string; claim: Claim | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const { retireClaim } = useSourceActions(sourceId);

  const close = () => {
    setReason('');
    onClose();
  };
  const submit = () => {
    if (!claim) return;
    retireClaim.mutate(
      { claimId: claim.id, reason: reason.trim() },
      {
        onSuccess: () => {
          toast.success('Claim retired', { description: 'Future drafts that say this again are flagged as a repeat.' });
          close();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  return (
    <Dialog open={Boolean(claim)} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retire this claim?</DialogTitle>
          <DialogDescription>Future drafts that say this again are flagged as a repeat.</DialogDescription>
        </DialogHeader>
        {claim && <p className="rounded-md bg-muted px-3 py-2 text-sm">{claim.text}</p>}
        <Field>
          <FieldLabel htmlFor="retire-reason">Why are you done saying this?</FieldLabel>
          <Textarea id="retire-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className="min-h-20" />
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!reason.trim() || retireClaim.isPending}>
            {retireClaim.isPending && <Spinner />} Retire claim
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
