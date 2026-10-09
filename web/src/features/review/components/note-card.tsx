import { useId, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

export function NoteCard({ note, busy, onSave }: { note: string | null; busy: boolean; onSave: (note: string) => Promise<unknown> }) {
  const [text, setText] = useState(note ?? '');
  const id = useId();
  const dirty = text.trim() !== (note ?? '');
  const save = async () => {
    try {
      await onSave(text);
      toast.success('Note saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  return (
    <Card className="gap-3 py-4 shadow-xs">
      <CardHeader className="px-4">
        <CardTitle className="text-sm">
          <label htmlFor={id}>Note</label>
        </CardTitle>
        <CardDescription>For you only, for example how the post did. Never used for drafting or checks.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 px-4">
        <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} className="min-h-20" />
        <Button variant="outline" size="sm" className="w-fit" disabled={!dirty || busy} onClick={() => void save()}>
          {busy && <Spinner />} Save note
        </Button>
      </CardContent>
    </Card>
  );
}
