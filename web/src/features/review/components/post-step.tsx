import { ExternalLinkIcon, SendIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { CopyButton } from './copy-button';
import { FinalPosts } from './final-posts';

const X_URL = /^https:\/\/(x|twitter)\.com\//;

interface PostStepProps {
  posts: string[];
  composeUrl: string;
  busy: boolean;
  onPosted: (url: string) => void;
  onEdit: () => void;
}

/** Confirmed: copy each post, open X with the first one, then mark it as posted. */
export function PostStep({ posts, composeUrl, busy, onPosted, onEdit }: PostStepProps) {
  const [url, setUrl] = useState('');
  const id = useId();
  const bad = url.trim() !== '' && !X_URL.test(url.trim());
  return (
    <div className="grid gap-4">
      <FinalPosts posts={posts} action={(post, i) => <CopyButton text={post} label={posts.length > 1 ? `Copy post ${i + 1}` : 'Copy post'} />} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <a href={composeUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon /> Open in X
          </a>
        </Button>
        {posts.length > 1 && <p className="text-xs text-muted-foreground">X opens with the first post. Add the others as replies.</p>}
      </div>
      <form
        className="grid gap-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!bad) onPosted(url.trim());
        }}
      >
        <Field data-invalid={bad || undefined}>
          <FieldLabel htmlFor={id}>Link to the post on X (optional)</FieldLabel>
          <Input id={id} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://x.com/you/status/123" aria-invalid={bad} />
          {bad && <FieldError>Use the post's x.com link, or leave it empty.</FieldError>}
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || bad}>
            {busy ? <Spinner /> : <SendIcon />} Mark as posted
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit}>
            Edit text
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Editing the text now cancels this confirmation.</p>
      </form>
    </div>
  );
}
