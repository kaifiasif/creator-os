import { z } from 'zod';

export const LabelsInput = z.object({
  labels: z.array(z.object({ piece_a: z.string().min(1), piece_b: z.string().min(1), same_angle: z.boolean() })).min(1, 'Send labels: [{piece_a, piece_b, same_angle}].'),
});
