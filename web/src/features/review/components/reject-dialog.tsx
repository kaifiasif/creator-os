import { useState } from 'react';
import type { RejectReason } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { REJECT_REASON } from '@/lib/labels';

interface RejectDialogProps {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onReject: (reason: RejectReason, note: string) => void;
}

const REASONS = Object.entries(REJECT_REASON) as [RejectReason, string][];

export function RejectDialog({ open, busy, onOpenChange, onReject }: RejectDialogProps) {
  const [reason, setReason] = useState<RejectReason | ''>('');
  const [note, setNote] = useState('');
  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setReason('');
      setNote('');
    }
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason) onReject(reason, note);
          }}
        >
          <DialogHeader>
            <DialogTitle>Reject this draft</DialogTitle>
            <DialogDescription>Pick the main reason. It is saved with your results.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={(v) => setReason(v as RejectReason)} aria-label="Reason" required>
            {REASONS.map(([value, label]) => (
              <Label key={value} htmlFor={`reason-${value}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-ring has-[[data-state=checked]]:bg-accent">
                <RadioGroupItem id={`reason-${value}`} value={value} />
                {label}
              </Label>
            ))}
          </RadioGroup>
          <Field>
            <FieldLabel htmlFor="reject-note">Note (optional)</FieldLabel>
            <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything you want to remember about it" maxLength={2000} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={!reason || busy}>
              {busy && <Spinner />} Reject draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
