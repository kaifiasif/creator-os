import { PlayIcon, RotateCwIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

interface RehearsalStartProps {
  offline: boolean;
  pending: boolean;
  retry: boolean;
  onStart: (audience: string | undefined) => void;
}

export function RehearsalStart({ offline, pending, retry, onStart }: RehearsalStartProps) {
  const [audience, setAudience] = useState('');
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        Simulates your followers on a mock X feed and shows who replies, who pushes back and which sentences they react to. Your draft and recent archive posts are sent to the configured model.
      </p>
      {offline && <p className="text-sm text-muted-foreground">No model key is set, so you'll get a rule-based estimate rather than simulated people.</p>}
      <Field>
        <FieldLabel htmlFor="rehearsal-audience">Who follows you (optional)</FieldLabel>
        <Textarea id="rehearsal-audience" value={audience} maxLength={2000} rows={3} placeholder="One group per line, for example: Skeptics who ask for sources" onChange={(e) => setAudience(e.target.value)} />
        <FieldDescription>Leave empty to use peers, skeptics, lurkers and newcomers.</FieldDescription>
      </Field>
      <Button size="sm" className="w-fit" disabled={pending} onClick={() => onStart(audience.trim() || undefined)}>
        {pending ? <Spinner /> : retry ? <RotateCwIcon /> : <PlayIcon />} {retry ? 'Try again' : 'Rehearse with followers'}
      </Button>
    </div>
  );
}
