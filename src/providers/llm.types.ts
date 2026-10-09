import { z } from 'zod';
import type { Claim, SentenceType } from '../domain/types.ts';

/** Every model output is validated against these schemas before anything trusts it. */
export const ClaimsOutput = z.object({
  claims: z.array(z.object({ segment: z.number().int().min(0), quote: z.string().trim().min(1), text: z.string().trim().min(1) })),
});
export const AnglesOutput = z.object({
  angles: z
    .array(z.object({ lead_claim_id: z.string().min(1), claim_ids: z.array(z.string()), rationale: z.string().trim().min(1) }))
    .min(1)
    .transform((angles) => angles.slice(0, 3)),
});
export const DraftOutput = z.object({
  posts: z
    .array(
      z.object({
        sentences: z
          .array(z.object({ text: z.string().trim().min(1), type: z.enum(['assertion', 'connective']), supports: z.array(z.string()) }))
          .min(1),
      }),
    )
    .min(1),
});
export const JudgmentOutput = z.object({ status: z.enum(['supported', 'partial', 'unsupported']), reason: z.string().trim().min(1) });

export type RawClaim = z.infer<typeof ClaimsOutput>['claims'][number];
export type ProposedAngle = z.infer<typeof AnglesOutput>['angles'][number];
export type DraftPost = { sentences: DraftSentenceInput[] };
export type DraftSentenceInput = { text: string; type: SentenceType; supports: string[] };
export type Judgment = z.infer<typeof JudgmentOutput>;

export interface Prompt {
  system: string;
  user: string;
}

export interface SegmentInput {
  position: number;
  speaker: string;
  text: string;
}

export type ClaimWithNovelty = Pick<Claim, 'id' | 'text' | 'speaker' | 'is_creator' | 'embedding'> & { closest: number };

export interface DraftRequest {
  claims: Pick<Claim, 'id' | 'text' | 'speaker' | 'is_creator'>[];
  leadClaimId: string;
  format: 'post' | 'thread';
  condition: 'gate' | 'context_only';
  voiceSummary: Record<string, unknown> | null;
  examples: { id: string; text: string }[];
  customAngle: string | null;
  prompt: Prompt;
}

export interface LlmProvider {
  readonly name: string;
  readonly models: { main: string; judge: string };
  extractClaims(input: { segments: SegmentInput[]; creatorSpeaker: string | null }): Promise<RawClaim[]>;
  proposeAngles(input: { claims: ClaimWithNovelty[] }): Promise<ProposedAngle[]>;
  generateDraft(input: DraftRequest): Promise<DraftPost[]>;
  judgeEntailment(input: { sentence: string; claims: Pick<Claim, 'text' | 'quote'>[] }): Promise<Judgment>;
}
