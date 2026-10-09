import { EyeOffIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DraftSentence, RunView } from '@/api/types';
import { Kbd } from '@/components/ui/kbd';
import { PostCard } from './post-card';
import { ProofSummary } from './proof-summary';

type Draft = NonNullable<RunView['draft']>;

function channelIssues(draft: Draft, position: number): string[] {
  const voice = draft.voice;
  const channel = voice && 'channel' in voice ? voice.channel : undefined;
  const result = channel?.find((c) => c.position === position);
  return result && !result.ok ? result.issues : [];
}

/** The draft as X posts, each sentence selectable. */
export function DraftPosts({ run, selected, onSelect, detail }: { run: RunView; selected: DraftSentence | null; onSelect: (id: string) => void; detail: ReactNode }) {
  const draft = run.draft;
  if (!draft) return null;
  const sentences = draft.posts.flatMap((p) => p.sentences);
  return (
    <section aria-label="Draft" className="grid gap-3">
      {run.decisions.length > 0 && <h2 className="pt-2 text-base font-semibold">The draft as written</h2>}
      {run.checks_visible ? (
        <ProofSummary sentences={sentences} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <EyeOffIcon className="size-4 shrink-0" /> Read it as you would before posting. Check results for this draft appear after you decide.
        </p>
      )}
      {draft.posts.map((post) => (
        <PostCard
          key={post.position}
          post={post}
          total={draft.posts.length}
          selectedId={selected?.id ?? null}
          enforce={run.enforce_flags}
          issues={channelIssues(draft, post.position)}
          onSelect={onSelect}
          detail={selected && post.sentences.some((s) => s.id === selected.id) ? detail : undefined}
        />
      ))}
      <p className="hidden text-xs text-muted-foreground sm:block">
        Select a sentence to see what it rests on. <Kbd>J</Kbd> and <Kbd>K</Kbd> move between sentences.
      </p>
    </section>
  );
}
