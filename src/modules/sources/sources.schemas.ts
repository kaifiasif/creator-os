import { z } from 'zod';
import { SOURCE_KINDS } from '../../domain/types.ts';

/** HTML checkboxes send "on"; JSON clients send true. Both mean yes. */
const checkbox = z
  .union([z.boolean(), z.enum(['true', 'false', 'on', 'off', ''])])
  .optional()
  .transform((v) => v === true || v === 'true' || v === 'on');

export const CreateSourceFields = z.object({
  title: z.string().max(200).optional(),
  kind: z.enum(SOURCE_KINDS).optional(),
  text: z.string().optional(),
  consent_confirmed: checkbox,
});
export type CreateSourceFields = z.infer<typeof CreateSourceFields>;

export const TranscriptInput = z.object({ text: z.string().trim().min(1, 'Paste the transcript text.') });
export const SpeakerMapInput = z.object({ creator_speaker: z.string().min(1) });
