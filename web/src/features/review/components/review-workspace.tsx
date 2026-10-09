import { useMemo } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { RunView } from '@/api/types';
import { useReviewActions } from '../api';
import { reviewPermissions } from '../hooks/review-permissions';
import { useReviewFlow } from '../hooks/use-review-flow';
import { useSentenceSelection } from '../hooks/use-sentence-selection';
import { hasChecks, problemReason } from '../lib/checks';
import { DecisionBar } from './decision-bar';
import { DecisionDetailsCard } from './decision-details-card';
import { DraftPosts } from './draft-posts';
import { NoteCard } from './note-card';
import { PostEditor } from './post-editor';
import { PublishPanel } from './publish-panel';
import { RejectDialog } from './reject-dialog';
import { RejectedCard } from './rejected-card';
import { ReviewAlerts } from './review-alerts';
import { ReviewHeader } from './review-header';
import { SentenceDetail, SentenceHint } from './sentence-detail';
import { SidePanel } from './side-panel';
import { UnresolvedFlagsDialog } from './unresolved-flags-dialog';

type Draft = NonNullable<RunView['draft']>;

/** The review screen for a run that has a draft: the posts and decisions on the left, evidence on the right. */
export function ReviewWorkspace({ run, draft, onRefresh }: { run: RunView; draft: Draft; onRefresh: () => void }) {
  const actions = useReviewActions(run.run_id, draft.id);
  const can = reviewPermissions(run);
  const flow = useReviewFlow(run, actions, can);
  const sentences = useMemo(() => draft.posts.flatMap((p) => p.sentences), [draft]);
  const claims = useMemo(() => new Map(run.claims.map((c) => [c.id, c])), [run.claims]);
  const selection = useSentenceSelection(sentences, !flow.editing);
  const blocking = run.enforce_flags ? sentences.filter((s) => s.blocking).length : 0;
  const latest = can.latest;

  const withToast = (m: { mutateAsync: () => Promise<unknown> }, done: string) => () =>
    void m.mutateAsync().then(
      () => toast.success(done),
      (e: unknown) => toast.error(errorMessage(e)),
    );
  const retryChecks = withToast(actions.retryRun, 'Running the checks again.');
  const retryAgents = withToast(actions.retryAgents, 'The agents are running again.');
  const reasonFor = (id: string) => {
    const s = sentences.find((x) => x.id === id);
    return s && hasChecks(s.checks) ? problemReason(s.checks) : null;
  };
  const canUseReviewer = !flow.editing && (can.canAccept || can.canEditAgain);

  const detail = selection.selected && (
    <SentenceDetail sentence={selection.selected} claims={claims} checksVisible={run.checks_visible} enforce={run.enforce_flags} onClose={selection.clear} />
  );

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
      <div className="flex min-w-0 flex-col gap-4">
        <ReviewHeader run={run} />
        <ReviewAlerts run={run} blocking={blocking} decided={can.decided} retrying={actions.retryRun.isPending} onRetryChecks={retryChecks} />
        {latest && !flow.editing && latest.decision === 'reject' && <RejectedCard decision={latest} onFix={can.canEditAgain ? () => flow.startEdit(draft.posts.map((p) => p.text)) : undefined} />}
        {latest && !flow.editing && latest.decision !== 'reject' && <PublishPanel draft={draft} decision={latest} actions={actions} flow={flow} onRefresh={onRefresh} />}
        {flow.editing ? (
          <PostEditor edit={flow.editing} thread={run.format === 'thread'} onChange={flow.setEditPosts} />
        ) : (
          <DraftPosts run={run} selected={selection.selected} onSelect={selection.toggle} detail={detail} />
        )}
        {can.decided && !flow.editing && (
          <div className="grid items-start gap-4 md:grid-cols-2">
            <DecisionDetailsCard run={run} />
            <NoteCard note={draft.note} busy={actions.saveNote.isPending} onSave={(n) => actions.saveNote.mutateAsync(n)} />
          </div>
        )}
        {(can.canReject || flow.editing) && (
          <DecisionBar
            editing={Boolean(flow.editing)}
            busy={flow.busy}
            canAccept={can.canAccept}
            canEdit={can.canAccept}
            canReject={can.canReject}
            blocking={blocking}
            checksFailed={can.checksFailed}
            onAccept={flow.accept}
            onEdit={() => flow.startEdit()}
            onReject={() => flow.setRejecting(true)}
            onSave={flow.saveEdit}
            onCancel={flow.cancelEdit}
          />
        )}
      </div>
      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:max-h-[calc(100svh-var(--header-height)-3rem)] lg:overflow-y-auto">
        <div className="hidden lg:block">{detail || <SentenceHint />}</div>
        <SidePanel
          run={run}
          claims={claims}
          selected={selection.selected}
          canRetryAgents={run.status === 'in_review' || run.status === 'decided'}
          retryingAgents={actions.retryAgents.isPending}
          onRetryAgents={retryAgents}
          onUseReviewer={canUseReviewer ? (posts) => flow.startEdit(posts, 'reviewer') : undefined}
        />
      </aside>
      <RejectDialog open={flow.rejecting} busy={flow.busy} onOpenChange={flow.setRejecting} onReject={(r, n) => void flow.reject(r, n)} />
      <UnresolvedFlagsDialog
        key={flow.pending?.unresolved.map((s) => s.sentence_id).join() ?? 'none'}
        pending={flow.pending}
        busy={flow.busy}
        reasonFor={reasonFor}
        onCancel={flow.dismissPending}
        onResolve={flow.resolvePending}
      />
    </div>
  );
}
