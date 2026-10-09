import { z } from 'zod';
import { REJECT_REASONS } from '../../domain/types.ts';

const OverrideInput = z
  .object({ sentence_id: z.string().min(1).optional(), sentence_text: z.string().min(1).optional(), reason: z.string().trim().min(1, 'Every override needs a reason.') })
  .refine((o) => o.sentence_id || o.sentence_text, { message: 'An override names a sentence_id or sentence_text.' });

/** A decision is one of three shapes; the discriminator makes the reject reason required exactly when it applies. */
export const DecisionInput = z.discriminatedUnion('decision', [
  z.object({
    decision: z.literal('reject'),
    reject_reason: z.enum(REJECT_REASONS, { message: `Pick a reason: ${REJECT_REASONS.join(', ')}.` }),
    reject_note: z.string().trim().max(2000).optional(),
    overrides: z.array(OverrideInput).default([]),
  }),
  z.object({
    decision: z.enum(['accept', 'edit_then_accept']),
    final_posts: z.array(z.string()).optional(),
    overrides: z.array(OverrideInput).default([]),
    assist: z.literal('reviewer').nullish(),
  }),
]);
export type DecisionInput = z.infer<typeof DecisionInput>;

export const PublishConfirmInput = z.object({ text_hash: z.string().min(1), typed_confirmation: z.string() });
export const PostedInput = z.object({
  url: z
    .string()
    .trim()
    .regex(/^https:\/\/(x|twitter)\.com\//, "Use the post's x.com link, or leave it empty.")
    .optional()
    .or(z.literal('')),
});
export const NoteInput = z.object({ note: z.string().max(5000).nullish() });
