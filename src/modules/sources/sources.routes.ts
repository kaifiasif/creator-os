import { bodyLimit } from 'hono/body-limit';
import { AppError, ErrorCode } from '../../core/errors.ts';
import { router } from '../../http/types.ts';
import { validate, validationError } from '../../http/validate.ts';
import { IdParam } from '../archive/archive.schemas.ts';
import { getAngles } from './angles.service.ts';
import { LIMITS, type UploadedFile } from './intake.ts';
import { CreateSourceFields, SpeakerMapInput, TranscriptInput } from './sources.schemas.ts';
import { createSource, getSource, listSources, pasteTranscript, retrySource, setSpeakerMap } from './sources.service.ts';

const MULTIPART_OVERHEAD = 5 * 1024 * 1024;

const uploadLimit = bodyLimit({
  maxSize: LIMITS.audio + MULTIPART_OVERHEAD,
  onError: () => {
    throw new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, 'Audio files can be up to 200 MB.');
  },
});

/** Accepts multipart (file uploads from the browser) or JSON (pasted text, scripts). */
async function readCreateRequest(req: Request): Promise<{ fields: unknown; file?: UploadedFile }> {
  const type = req.headers.get('content-type') ?? '';
  if (!type.includes('multipart/form-data')) return { fields: await req.json().catch(() => ({})) };
  const form = await req.formData();
  const fields: Record<string, string> = {};
  let file: UploadedFile | undefined;
  for (const [key, value] of form) {
    if (typeof value === 'string') fields[key] = value;
    else if (key === 'file' && value.size > 0) file = { filename: value.name, contentType: value.type, data: new Uint8Array(await value.arrayBuffer()) };
  }
  return { fields, file };
}

export function sourcesRoutes() {
  return router()
    .get('/sources', (c) => c.json(listSources(c.var.ctx)))
    .post('/sources', uploadLimit, async (c) => {
      const { fields, file } = await readCreateRequest(c.req.raw);
      const parsed = CreateSourceFields.safeParse(fields);
      if (!parsed.success) throw validationError(parsed.error);
      return c.json(await createSource(c.var.ctx, { ...parsed.data, file }), 202);
    })
    .get('/sources/:id', validate('param', IdParam), (c) => c.json(getSource(c.var.ctx, c.req.valid('param').id)))
    .post('/sources/:id/transcript', validate('param', IdParam), validate('json', TranscriptInput), (c) =>
      c.json(pasteTranscript(c.var.ctx, c.req.valid('param').id, c.req.valid('json').text), 202))
    .post('/sources/:id/retry', validate('param', IdParam), (c) => c.json(retrySource(c.var.ctx, c.req.valid('param').id), 202))
    .post('/sources/:id/speaker-map', validate('param', IdParam), validate('json', SpeakerMapInput), (c) =>
      c.json(setSpeakerMap(c.var.ctx, c.req.valid('param').id, c.req.valid('json').creator_speaker), 202))
    .get('/sources/:id/angles', validate('param', IdParam), async (c) => c.json({ angles: await getAngles(c.var.ctx, c.req.valid('param').id) }));
}
