/** How each draft ended up, for the acceptance metric (FR-009). Pure. */
import type { Decision, Draft, Outcome } from '../../domain/types.ts';

/** An accepted draft counts as a "light edit" at or below this normalised edit distance. */
export const LIGHT_EDIT_MAX = 0.15;
/** A reject that is fixed and confirmed within this window counts as "rejected, then fixed". */
export const FIX_WINDOW_MS = 120 * 1000;
/** A reject with no confirmed fix after this long counts as abandoned. */
export const ABANDON_MS = 48 * 3600 * 1000;

export const latestAccept = (decisions: Decision[]): Decision | null => {
  const last = decisions.at(-1);
  return last && last.decision !== 'reject' ? last : null;
};

export function classifyOutcome(draft: Pick<Draft, 'confirmed_at'>, decisions: Decision[], now = Date.now()): Outcome {
  const first = decisions[0];
  if (!first) return 'pending';
  if (first.decision === 'reject') {
    const confirmedAt = draft.confirmed_at ? Date.parse(draft.confirmed_at) : null;
    if (confirmedAt !== null && confirmedAt - Date.parse(first.decided_at) <= FIX_WINDOW_MS) return 'rejected_fixed';
    if (confirmedAt !== null) return 'substantive_rewrite';
    return now - Date.parse(first.decided_at) > ABANDON_MS ? 'abandoned' : 'rejected_pending';
  }
  const accepted = latestAccept(decisions);
  return accepted && (accepted.edit_ratio ?? 1) <= LIGHT_EDIT_MAX && !accepted.claim_set_changed ? 'light_accept' : 'substantive_rewrite';
}
