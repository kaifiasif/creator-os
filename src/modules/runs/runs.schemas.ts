import { z } from 'zod';

export const CreateRunInput = z.object({
  source_item_id: z.string().min(1),
  format: z.enum(['post', 'thread']).default('thread'),
  memory_enabled: z.boolean().default(true),
  angle_claim_ids: z.array(z.string().min(1)).default([]),
  angle_choice: z.enum(['picked', 'custom']).optional(),
  custom_angle: z.string().max(500).optional(),
});
export type CreateRunInput = z.infer<typeof CreateRunInput>;
