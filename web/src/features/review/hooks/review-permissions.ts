import type { RunView } from '@/api/types';

/** What the creator may do right now, mirroring the server's rules so buttons never promise a 409. */
export function reviewPermissions(run: RunView) {
  const draft = run.draft;
  const decided = run.decisions.length > 0;
  const latest = run.decisions.at(-1) ?? null;
  const posted = Boolean(draft?.posted_at);
  const checksFailed = draft?.gate_status === 'gate_failed';
  const canReject = Boolean(draft) && !decided && (run.status === 'in_review' || run.status === 'gate_failed');
  return {
    decided,
    latest,
    posted,
    checksFailed,
    canReject,
    canAccept: canReject && !checksFailed,
    canEditAgain: Boolean(draft) && decided && !posted && !checksFailed,
  };
}

export type ReviewPermissions = ReturnType<typeof reviewPermissions>;
