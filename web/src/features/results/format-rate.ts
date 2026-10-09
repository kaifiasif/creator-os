import { formatPercent, plural } from '@/lib/format';
import type { RateStat } from './types';

export const formatInterval = ([low, high]: readonly [number, number] | number[]) => `${formatPercent(low)} to ${formatPercent(high)}`;

/** "2 of 4 runs, 95% interval 15% to 85%", or a plain note when there is nothing to count yet. */
export function rateFootnote(stat: Pick<RateStat, 'n' | 'ci95'> & { k: number }) {
  if (!stat.n) return 'No decided runs yet';
  return `${stat.k} of ${plural(stat.n, 'run')}, 95% interval ${formatInterval(stat.ci95)}`;
}

/** Rates arrive as 0..1 or null; charts want whole percentages. */
export const toPercent = (x: number | null) => (x === null ? null : Math.round(x * 100));
