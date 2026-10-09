import { PlusIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { EditState } from '../hooks/use-review-flow';
import { CharCount } from './char-count';

/** One textarea per post, with a live X character count. Threads can gain or lose posts. */
export function PostEditor({ edit, thread, onChange }: { edit: EditState; thread: boolean; onChange: (posts: string[]) => void }) {
  const { posts } = edit;
  const set = (i: number, text: string) => onChange(posts.map((p, k) => (k === i ? text : p)));
  return (
    <section aria-label="Edit the draft" className="grid gap-3">
      {edit.assist === 'reviewer' && (
        <Alert>
          <WandSparklesIcon />
          <AlertDescription>You are starting from the Reviewer's version. Every check runs again when you save.</AlertDescription>
        </Alert>
      )}
      {posts.map((text, i) => (
        <Card key={i} className="gap-2 py-4 shadow-xs">
          <CardHeader className="px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              <label htmlFor={`post-${i}`}>{posts.length > 1 ? `Post ${i + 1} of ${posts.length}` : 'Post'}</label>
            </CardTitle>
            <CardAction className="flex items-center gap-2">
              <CharCount text={text} />
              {posts.length > 1 && (
                <Button variant="ghost" size="icon" className="size-7" aria-label={`Remove post ${i + 1}`} onClick={() => onChange(posts.filter((_, k) => k !== i))}>
                  <Trash2Icon />
                </Button>
              )}
            </CardAction>
          </CardHeader>
          <CardContent className="px-4">
            <Textarea id={`post-${i}`} value={text} onChange={(e) => set(i, e.target.value)} className="min-h-28 text-[15px] leading-7" autoFocus={i === 0} />
          </CardContent>
        </Card>
      ))}
      {thread && (
        <Button variant="outline" className="w-fit" onClick={() => onChange([...posts, ''])}>
          <PlusIcon /> Add post
        </Button>
      )}
    </section>
  );
}
