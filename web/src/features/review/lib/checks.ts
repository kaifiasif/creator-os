/** Pure readings of a sentence's check results. */
import type { DraftSentence } from '@/api/types';
import type { Tone } from '@/lib/labels';
import type { Checks, StoredChecks } from './types';

export type Problem = 'unsupported' | 'partial' | 'repeat';

export const hasChecks = (c: StoredChecks | null | undefined): c is Checks => Boolean(c && 'traceability' in c);

export const checkError = (c: StoredChecks | null | undefined): string | null => (c && 'error' in c ? c.error : null);

/** Problems in order of severity; empty when the sentence checks out. */
export function problemsOf(checks: Checks | null | undefined): Problem[] {
  if (!checks) return [];
  const out: Problem[] = [];
  if (checks.traceability.status === 'unsupported') out.push('unsupported');
  if (checks.repetition.flag) out.push('repeat');
  if (checks.traceability.status === 'partial') out.push('partial');
  return out;
}

export const isBlockingChecks = (c: Checks) => c.traceability.status !== 'supported' || c.repetition.flag;

export const topProblem = (s: Pick<DraftSentence, 'checks'>): Problem | null => (hasChecks(s.checks) ? (problemsOf(s.checks)[0] ?? null) : null);

/** One plain sentence saying why a sentence was flagged. */
export function problemReason(checks: Checks): string {
  if (checks.repetition.flag) {
    if (checks.repetition.retired_match) return `Close to an angle you retired: ${checks.repetition.retired_match.reason}`;
    const match = checks.repetition.matches[0];
    return match ? `Close to something you posted before (${Math.round(match.similarity * 100)}% similar).` : 'Close to something you posted before.';
  }
  return checks.traceability.reason;
}

export const PROBLEM_UNDERLINE: Record<Problem, string> = {
  unsupported: 'decoration-unsupported',
  partial: 'decoration-partial',
  repeat: 'decoration-repeat',
};

export const PROBLEM_TONE: Record<Problem, Tone> = { unsupported: 'unsupported', partial: 'partial', repeat: 'repeat' };
