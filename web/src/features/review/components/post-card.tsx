import { Fragment, type ReactNode } from 'react';
import type { DraftPost } from '@/api/types';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CharCount } from './char-count';
import { Sentence } from './sentence';

interface PostCardProps {
  post: DraftPost;
  total: number;
  selectedId: string | null;
  enforce: boolean;
  issues: string[];
  onSelect: (id: string) => void;
  /** The selected sentence's details, shown inside the post on small screens. */
  detail?: ReactNode;
}

export function PostCard({ post, total, selectedId, enforce, issues, onSelect, detail }: PostCardProps) {
  return (
    <Card className="gap-3 py-4 shadow-xs">
      <CardHeader className="px-4 sm:px-5">
        <CardTitle className="text-sm font-medium text-muted-foreground">{total > 1 ? `Post ${post.position} of ${total}` : 'Post'}</CardTitle>
        <CardAction>
          <CharCount text={post.text} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3 px-4 sm:px-5">
        <p className="text-[15px] leading-7 text-pretty">
          {post.sentences.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 && ' '}
              <Sentence sentence={s} selected={s.id === selectedId} enforce={enforce} onSelect={() => onSelect(s.id)} />
            </Fragment>
          ))}
        </p>
        {issues.length > 0 && <p className="text-sm text-unsupported">{issues.join(' ')}</p>}
        {detail && <div className="lg:hidden">{detail}</div>}
      </CardContent>
    </Card>
  );
}
