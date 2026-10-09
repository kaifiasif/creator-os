import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { FinalPosts } from './final-posts';

const WORD = 'POST';

/** The typed confirmation: the creator types POST against the exact text that passed the re-check. */
export function ConfirmStep({ posts, busy, onConfirm, onEdit }: { posts: string[]; busy: boolean; onConfirm: () => void; onEdit: () => void }) {
  const [typed, setTyped] = useState('');
  const id = useId();
  const ready = typed === WORD;
  return (
    <div className="grid gap-4">
      <FinalPosts posts={posts} />
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) onConfirm();
        }}
      >
        <Field>
          <FieldLabel htmlFor={id}>Type {WORD} to confirm this exact text</FieldLabel>
          <Input id={id} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} className="max-w-48 font-mono tracking-widest" data-testid="typed-post" />
          <FieldDescription>Creator OS never posts for you. After you confirm, copy the text or open X yourself.</FieldDescription>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!ready || busy}>
            {busy && <Spinner />} Confirm final text
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit}>
            Edit first
          </Button>
        </div>
      </form>
    </div>
  );
}
