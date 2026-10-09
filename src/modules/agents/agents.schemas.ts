import { z } from 'zod';

export const SettingsInput = z
  .object({ agents_enabled: z.boolean().optional(), show_recommendation: z.boolean().optional() })
  .strict();
