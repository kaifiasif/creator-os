import { hashInt, rng } from '../../domain/stats.ts';
import type { Condition } from '../../domain/types.ts';

/**
 * Seeded block randomisation: runs are paired in creation order and each pair holds one gate and
 * one context_only run, in a seeded order. Balanced and reproducible. Pure, so it is tested directly.
 */
export function assignCondition(runIndex: number, seedBase: number, forced?: Condition): { condition: Condition; seed: number } {
  const block = Math.floor(runIndex / 2);
  const seed = hashInt(`${seedBase}:block:${block}`);
  const firstIsGate = rng(seed)() < 0.5;
  const isFirst = runIndex % 2 === 0;
  return { condition: forced ?? (firstIsGate === isFirst ? 'gate' : 'context_only'), seed };
}
