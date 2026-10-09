import type { ReactNode } from 'react';
import { CharCount } from './char-count';

/** The exact text that will be posted, one box per post. */
export function FinalPosts({ posts, action }: { posts: string[]; action?: (post: string, index: number) => ReactNode }) {
  return (
    <ol className="grid gap-2">
      {posts.map((post, i) => (
        <li key={i} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{posts.length > 1 ? `Post ${i + 1} of ${posts.length}` : 'Post'}</span>
            <CharCount text={post} />
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post}</p>
          {action?.(post, i)}
        </li>
      ))}
    </ol>
  );
}
