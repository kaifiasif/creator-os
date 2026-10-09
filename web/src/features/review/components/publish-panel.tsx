import { ExternalLinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/api/errors';
import type { RunView } from '@/api/types';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/format';
import type { useReviewActions } from '../api';
import type { ReviewFlow } from '../hooks/use-review-flow';
import { RECHECK_STATUS } from '@/lib/labels';
import type { Decision } from '../lib/types';
import { ConfirmStep } from './confirm-step';
import { FinalPosts } from './final-posts';
import { PostStep } from './post-step';
import { RecheckResult } from './recheck-result';

type Actions = ReturnType<typeof useReviewActions>;
type Draft = NonNullable<RunView['draft']>;

const intentUrl = (text: string) => `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

const STEP_COPY = {
  recheck: { title: 'Fix the final text', description: 'Every check ran again on the text you would post.' },
  confirm: { title: 'Ready to publish', description: 'Posting cannot be undone. Read it once more, then confirm.' },
  post: { title: 'Post it yourself', description: 'The text is confirmed. Copy it or open X, then come back and mark it as posted.' },
  posted: { title: 'Posted', description: '' },
};

interface PublishPanelProps {
  draft: Draft;
  decision: Decision;
  actions: Actions;
  flow: ReviewFlow;
  onRefresh: () => void;
}

/** After an accept: the re-check result, the typed confirmation, the copy and X link, and the posted marker. */
export function PublishPanel({ draft, decision, actions, flow, onRefresh }: PublishPanelProps) {
  const posts = decision.final_posts ?? [];
  const status = decision.recheck_status ?? 'gate_failed';
  const step = draft.posted_at ? 'posted' : status !== 'clean' ? 'recheck' : draft.confirmed ? 'post' : 'confirm';
  const editAgain = () => flow.startEdit(posts);
  const published = actions.confirmPublish.data;

  const confirm = async () => {
    if (!decision.text_hash) return;
    try {
      await actions.confirmPublish.mutateAsync(decision.text_hash);
      toast.success('Confirmed. Copy the text or open X to post it.');
    } catch (error) {
      if (isApiError(error, 'TEXT_CHANGED')) {
        toast.error('The text changed since it was checked. The latest version is shown now.');
        onRefresh();
      } else toast.error(errorMessage(error));
    }
  };

  const markPosted = async (url: string) => {
    try {
      await actions.markPosted.mutateAsync(url);
      toast.success('Marked as posted.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const copy = STEP_COPY[step];
  return (
    <Card className="shadow-xs" aria-label="Publish">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{step === 'posted' ? `Marked as posted on ${formatDate(draft.posted_at)}.` : copy.description}</CardDescription>
        <CardAction>
          <StatusBadge status={{ label: RECHECK_STATUS[status], tone: status === 'clean' ? 'supported' : 'unsupported' }} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {step === 'recheck' && <RecheckResult decision={decision} busy={flow.busy} onEdit={editAgain} onRecheck={(keep) => flow.recheckWithReasons(posts, keep)} />}
        {step === 'confirm' && <ConfirmStep posts={posts} busy={actions.confirmPublish.isPending} onConfirm={() => void confirm()} onEdit={editAgain} />}
        {step === 'post' && (
          <PostStep
            posts={published?.copy_text ?? posts}
            composeUrl={published?.compose_url ?? intentUrl(posts[0] ?? '')}
            busy={actions.markPosted.isPending}
            onPosted={(url) => void markPosted(url)}
            onEdit={editAgain}
          />
        )}
        {step === 'posted' && (
          <div className="grid gap-3">
            <FinalPosts posts={posts} />
            {draft.posted_url && (
              <a href={draft.posted_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline">
                Open the post on X <ExternalLinkIcon className="size-3.5" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
