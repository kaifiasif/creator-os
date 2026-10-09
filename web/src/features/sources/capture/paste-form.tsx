import { useMemo, useState, type FormEvent } from 'react';
import type { SourceKind } from '@/api/types';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { plural } from '@/lib/format';
import { AddError } from './add-error';
import { needsConsent, textTooLarge } from './intake-rules';
import { ConsentField, KindSelect } from './kind-fields';
import { sniffTranscript } from './sniff';
import { useCreateSource } from './use-create-source';

const PLACEHOLDER = 'Paste a transcript or rough notes. For a call, one line per turn:\nKaifi [00:12]: what I said\nPriya [00:31]: what they said';

export function PasteForm() {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<SourceKind>('note');
  const [kindTouched, setKindTouched] = useState(false);
  const [consent, setConsent] = useState(false);
  const [text, setText] = useState('');
  const create = useCreateSource();
  const sniff = useMemo(() => sniffTranscript(text), [text]);

  // a conversation is probably a call, until the creator says otherwise
  const effectiveKind: SourceKind = kindTouched ? kind : sniff.speakers.length ? 'call' : 'note';
  const tooLarge = textTooLarge(text);
  const blocked = !text.trim() || tooLarge || (needsConsent(effectiveKind) && !consent);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    create.mutate(
      { title: title.trim() || undefined, kind: effectiveKind, consent_confirmed: consent, text },
      {
        onSuccess: () => {
          setTitle('');
          setText('');
          setConsent(false);
          setKindTouched(false);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field>
            <FieldLabel htmlFor="paste-title">Title</FieldLabel>
            <Input id="paste-title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="For example, walk memo about review time" />
          </Field>
          <Field>
            <FieldLabel htmlFor="paste-kind">Kind</FieldLabel>
            <KindSelect
              id="paste-kind"
              value={effectiveKind}
              onChange={(next) => {
                setKind(next);
                setKindTouched(true);
              }}
              className="w-full sm:w-36"
            />
          </Field>
        </div>
        <Field data-invalid={tooLarge}>
          <FieldLabel htmlFor="paste-text">Transcript or notes</FieldLabel>
          <Textarea id="paste-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER} aria-invalid={tooLarge} className="min-h-56 leading-relaxed" />
          <FieldDescription>
            {tooLarge
              ? 'This is over 100 KB. Split it into smaller pieces, or upload the audio instead.'
              : sniff.speakers.length
                ? `${plural(sniff.words, 'word')} from ${plural(sniff.speakers.length, 'speaker')}: ${sniff.speakers.map((s) => s.name).join(', ')}. You will pick which one is you.`
                : plural(sniff.words, 'word')}
          </FieldDescription>
        </Field>
        {needsConsent(effectiveKind) && <ConsentField id="paste-consent" checked={consent} onChange={setConsent} />}
      </FieldGroup>
      {create.isError && <AddError error={create.error} />}
      <div className="flex justify-end">
        <Button type="submit" disabled={blocked || create.isPending}>
          {create.isPending && <Spinner />} Add to inbox
        </Button>
      </div>
    </form>
  );
}
