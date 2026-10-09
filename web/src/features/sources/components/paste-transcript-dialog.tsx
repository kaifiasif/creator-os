import { ClipboardPasteIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useSourceActions } from '../api';

/** Replaces a failed or unusable transcript with one the creator pastes. */
export function PasteTranscriptDialog({ id, label = 'Paste the transcript instead', variant = 'outline' }: { id: string; label?: string; variant?: 'outline' | 'default' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { pasteTranscript } = useSourceActions(id);

  const submit = () =>
    pasteTranscript.mutate(text, {
      onSuccess: () => {
        setOpen(false);
        setText('');
        toast.success('Transcript saved', { description: 'Claims are being found again.' });
      },
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size="sm">
          <ClipboardPasteIcon /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste the transcript</DialogTitle>
          <DialogDescription>This replaces the current transcript, then claims are found again.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={`transcript-${id}`}>Transcript</FieldLabel>
          <Textarea id={`transcript-${id}`} value={text} onChange={(e) => setText(e.target.value)} className="max-h-[50vh] min-h-48" placeholder={'Kaifi [00:12]: what I said\nPriya [00:31]: what they said'} />
          <FieldDescription>One line per turn, with the speaker’s name first. Plain notes work too.</FieldDescription>
        </Field>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={submit} disabled={!text.trim() || pasteTranscript.isPending}>
            {pasteTranscript.isPending && <Spinner />} Use this transcript
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
