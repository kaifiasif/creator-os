import type { RunSummary } from '@/api/types';

export type DraftFilter = 'review' | 'all' | 'decided' | 'posted';

const needsReview = (r: RunSummary) => r.decisions === 0 && (r.status === 'in_review' || r.status === 'gate_failed');

/** Each tab's rule, so the counts and the table can never disagree. */
export const DRAFT_FILTERS: { value: DraftFilter; label: string; test: (r: RunSummary) => boolean }[] = [
  { value: 'review', label: 'Needs review', test: needsReview },
  { value: 'all', label: 'All', test: () => true },
  { value: 'decided', label: 'Decided', test: (r) => r.status === 'decided' && !r.posted_at },
  { value: 'posted', label: 'Posted', test: (r) => Boolean(r.posted_at) },
];

export function draftCounts(runs: RunSummary[]) {
  return {
    waiting: runs.filter(needsReview).length,
    decided: runs.filter((r) => r.status === 'decided').length,
    posted: runs.filter((r) => r.posted_at).length,
    failed: runs.filter((r) => r.status === 'failed' || r.status === 'gate_failed').length,
    drafting: runs.filter((r) => r.status === 'generating').length,
  };
}
