import { createElement, useState } from 'react';
import { Mascot } from '@/components/shared/mascot/mascot';
import { toast } from 'sonner';
import { errorMessage, isApiError } from '@/api/errors';
import type { DecisionInput, DecisionResult, Override, RejectReason, RunView } from '@/api/types';
import { useHotkey } from '@/hooks/use-hotkey';
import { plural } from '@/lib/format';
import type { useReviewActions } from '../api';
import { cleanPosts, replaceSentence, samePosts } from '../lib/posts';
import type { UnresolvedSentence } from '../lib/types';
import type { ReviewPermissions } from './review-permissions';

type Assist = 'reviewer' | null;
type Actions = ReturnType<typeof useReviewActions>;

export interface EditState {
  posts: string[];
  assist: Assist;
}

export interface PendingAccept {
  posts: string[];
  unresolved: UnresolvedSentence[];
  overrides: Override[];
  assist: Assist;
}

export type Resolution = { kind: 'remove' } | { kind: 'edit'; text: string } | { kind: 'keep'; reason: string };

function readUnresolved(details: Record<string, unknown> | undefined): UnresolvedSentence[] | null {
  const list = details?.unresolved;
  if (!Array.isArray(list)) return null;
  return list.flatMap((item: unknown) => {
    if (typeof item !== 'object' || item === null) return [];
    const { sentence_id, text } = item as Record<string, unknown>;
    return typeof sentence_id === 'string' && typeof text === 'string' ? [{ sentence_id, text }] : [];
  });
}

function announce(result: DecisionResult) {
  if (result.decision === 'reject') return toast('Rejected. The reason is saved with your results.');
  if (result.recheck_status === 'clean') return toast.success('Accepted. The final text passed every check.', { icon: createElement(Mascot, { pose: 'stamp', className: 'size-7' }) });
  if (result.recheck_status === 'gate_failed') return toast.warning('Accepted, but the checks could not run on the final text. Run them again before publishing.');
  return toast.warning('Accepted, but the final text has flags to resolve before publishing.');
}

/** The decision workflow: accept, edit, reject, and resolving the flags the server refuses to accept. */
export function useReviewFlow(run: RunView, actions: Actions, can: ReviewPermissions) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [pending, setPending] = useState<PendingAccept | null>(null);
  const original = run.draft?.posts.map((p) => p.text) ?? [];
  const busy = actions.decide.isPending;

  async function submit(posts: string[] | null, overrides: Override[], assist: Assist) {
    const final = posts ? cleanPosts(posts) : null;
    const input: DecisionInput = {
      decision: final && !samePosts(final, original) ? 'edit_then_accept' : 'accept',
      ...(final ? { final_posts: final } : {}),
      overrides,
      assist,
    };
    try {
      announce(await actions.decide.mutateAsync(input));
      setEditing(null);
      setPending(null);
    } catch (error) {
      const unresolved = isApiError(error, 'UNRESOLVED_FLAGS') ? readUnresolved(error.details) : null;
      if (unresolved?.length) setPending({ posts: final ?? original, unresolved, overrides, assist });
      else toast.error(errorMessage(error));
    }
  }

  const accept = () => void submit(null, [], null);

  const startEdit = (posts?: string[], assist: Assist = null) => {
    const latest = can.latest;
    const base = posts ?? (latest && latest.decision !== 'reject' && latest.final_posts ? latest.final_posts : original);
    setEditing({ posts: [...base], assist });
  };

  const saveEdit = () => editing && void submit(editing.posts, [], editing.assist);

  /** Applies the creator's choice for each refused sentence and tries the accept again. */
  function resolvePending(resolutions: Record<string, Resolution>) {
    if (!pending) return;
    let posts = pending.posts;
    const overrides = [...pending.overrides];
    for (const s of pending.unresolved) {
      const r = resolutions[s.sentence_id];
      if (r?.kind === 'remove') posts = replaceSentence(posts, s.text, '');
      if (r?.kind === 'edit') posts = replaceSentence(posts, s.text, r.text.trim());
      if (r?.kind === 'keep') overrides.push({ sentence_id: s.sentence_id, reason: r.reason.trim() });
    }
    void submit(posts, overrides, pending.assist);
  }

  /** After a flagged re-check: keep the named sentences with a reason and check the same text again. */
  const recheckWithReasons = (posts: string[], keep: { sentence_text: string; reason: string }[]) => void submit(posts, keep, null);

  async function reject(reason: RejectReason, note: string) {
    try {
      announce(await actions.decide.mutateAsync({ decision: 'reject', reject_reason: reason, reject_note: note.trim() || undefined }));
      setRejecting(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const idle = !editing && !busy;
  useHotkey('a', accept, { enabled: idle && can.canAccept });
  useHotkey('e', () => startEdit(), { enabled: idle && (can.canAccept || can.canEditAgain) });
  useHotkey('r', () => setRejecting(true), { enabled: idle && can.canReject });
  useHotkey('Enter', (e) => {
    e.preventDefault();
    saveEdit();
  }, { mod: true, enabled: Boolean(editing) && !busy });

  return {
    busy,
    editing,
    setEditPosts: (posts: string[]) => setEditing((e) => (e ? { ...e, posts } : e)),
    startEdit,
    cancelEdit: () => setEditing(null),
    saveEdit,
    accept,
    rejecting,
    setRejecting,
    reject,
    pending,
    dismissPending: () => setPending(null),
    resolvePending,
    recheckWithReasons,
    unresolvedLabel: pending ? plural(pending.unresolved.length, 'flagged sentence') : '',
  };
}

export type ReviewFlow = ReturnType<typeof useReviewFlow>;
