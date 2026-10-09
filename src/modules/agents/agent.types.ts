import { z } from 'zod';
import type { AppContext } from '../../context.ts';
import type { Claim, Draft, DraftSentence, Run, TraceStep } from '../../domain/types.ts';
import { REJECT_REASONS } from '../../domain/types.ts';

/** What every agent sees: one run, its draft and the verified claims it may cite. Loaded once per pass. */
export interface AgentContext {
  run: Run;
  draft: Draft;
  rows: DraftSentence[];
  claims: Pick<Claim, 'id' | 'text' | 'speaker' | 'is_creator' | 'quote'>[];
  posts: string[];
}

// ---------------------------------------------------------------- agent outputs
// The Python agents service validates these too; the web app checks them again before storing anything.
export const REVIEW_PROBLEMS = ['unsupported', 'partial', 'repeat', 'voice', 'clarity', 'channel'] as const;

export const ReviewSubmission = z.object({
  summary: z.string().trim().min(1).describe('One or two sentences for the creator.'),
  issues: z.array(
    z
      .object({
        sentence_id: z.string().min(1),
        problem: z.enum(REVIEW_PROBLEMS),
        action: z.enum(['replace', 'remove', 'keep']),
        replacement: z.string().trim().min(1).optional(),
        supports: z.array(z.string()).optional(),
        note: z.string(),
      })
      .refine((i) => i.action !== 'replace' || i.replacement, { message: 'replace needs replacement text', path: ['replacement'] }),
  ),
  revised_posts: z.array(z.string()).describe('The full draft with your fixes applied.'),
});
export type ReviewSubmission = z.infer<typeof ReviewSubmission>;

const Scored = z.object({ score: z.number().min(1).max(5), reason: z.string().trim().min(1) });
export const ScorerJudgment = z.object({ hook: Scored, clarity: Scored, comment: z.string().trim().min(1) });
export type ScorerJudgment = z.infer<typeof ScorerJudgment>;

export const DecisionPrediction = z
  .object({
    recommendation: z.enum(['accept', 'edit', 'reject']),
    reject_reason: z.enum(REJECT_REASONS).optional(),
    confidence: z.number().min(0).max(1),
    rationale: z.string().trim().min(1),
  })
  .refine((o) => o.recommendation !== 'reject' || o.reject_reason, { message: `reject needs reject_reason: ${REJECT_REASONS.join(', ')}`, path: ['reject_reason'] });
export type DecisionPrediction = z.infer<typeof DecisionPrediction>;

// ---------------------------------------------------------------- stored outputs
export interface Verification {
  blocking?: number;
  sentences?: Record<string, unknown>[];
  channel?: unknown[];
  empty?: boolean;
  gate_failed?: boolean;
  error?: string | null;
}

export type ReviewOutput = ReviewSubmission & { changed: boolean; verification: Verification };

export const Dimension = z.object({ score: z.number().min(1).max(5), reason: z.string(), by: z.enum(['rule', 'model']) });
export type Dimension = z.infer<typeof Dimension>;
export const ScoreOutput = z.object({ dimensions: z.record(z.string(), Dimension), overall: z.number().min(1).max(5), comment: z.string() });
export type ScoreOutput = z.infer<typeof ScoreOutput>;

export interface PriorOutputs {
  reviewer: ReviewOutput | null;
  scorer: ScoreOutput | null;
}

// ---------------------------------------------------------------- test seam
export type ReviewerImpl = (app: AppContext, agent: AgentContext, trace: TraceStep[]) => Promise<ReviewSubmission>;
export type ScorerImpl = (app: AppContext, agent: AgentContext, trace: TraceStep[]) => Promise<ScoreOutput>;
export type DecisionImpl = (app: AppContext, agent: AgentContext, trace: TraceStep[], prior: PriorOutputs) => Promise<DecisionPrediction>;

/** Test seam (ctx.agentOverrides): run any agent in-process instead of in the agents service. */
export interface AgentImplementations {
  reviewer?: ReviewerImpl;
  scorer?: ScorerImpl;
  decision?: DecisionImpl;
}
