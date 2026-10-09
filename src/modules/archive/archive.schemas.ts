import { z } from 'zod';

const ImportItem = z.object({
  text: z.string(),
  external_id: z.union([z.string(), z.number()]).transform(String).optional(),
  published_at: z.string().optional(),
  url: z.string().nullish(),
  in_reply_to: z.string().nullish(),
  is_retweet: z.boolean().optional(),
});

export const ArchiveImportInput = z
  .object({
    format: z.enum(['paste', 'csv', 'x_export']).default('paste'),
    raw: z.string().max(25_000_000).optional(),
    items: z.array(ImportItem).max(50_000).optional(),
    include_replies: z.boolean().default(false),
    /** Import only these external ids (from a preview). */
    only: z.array(z.union([z.string(), z.number()]).transform(String)).optional(),
  })
  .refine((v) => v.items !== undefined || Boolean(v.raw?.trim()), { message: 'Send "items" or "raw" with the archive content.' });
export type ArchiveImportInput = z.infer<typeof ArchiveImportInput>;

export const RetireInput = z.object({
  reason: z.string().trim().min(1, 'Say why you are retiring this angle.').max(500),
});
export type RetireInput = z.infer<typeof RetireInput>;

export const IdParam = z.object({ id: z.string().min(1).max(64) });
