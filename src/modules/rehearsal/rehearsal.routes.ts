import { z } from 'zod';
import type { AppContext, AppServices } from '../../context.ts';
import { AppError, ErrorCode } from '../../core/errors.ts';
import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { IdParam } from '../archive/archive.schemas.ts';
import { RehearsalError, rehearsalService } from './engine/index.js';

const StartInput = z.object({
  audience: z.string().trim().max(2000).optional(),
  max_rounds: z.number().int().min(1).max(40).optional(),
  force: z.boolean().optional(),
});
const InterviewInput = z.object({
  agent_id: z.number().int().min(0),
  prompt: z.string().trim().min(1).max(1000),
});

// The error handler hides 5xx messages, so "rehearsal is off" (503) and "model failed" (502) are sent
// as 409/424: the creator needs to read them.
function toAppError(e: unknown): never {
  if (e instanceof RehearsalError) {
    const status = e.status === 503 ? 409 : e.status === 502 ? 424 : e.status === 422 ? 400 : e.status;
    const code = status === 404 ? ErrorCode.NOT_FOUND : status === 400 ? ErrorCode.VALIDATION_FAILED : status === 429 ? ErrorCode.RATE_LIMITED : ErrorCode.INVALID_STATE;
    throw new AppError(status, code, e.message);
  }
  throw e;
}
const guard = <T>(work: () => T): T => {
  try {
    const out = work();
    return out instanceof Promise ? (out.catch(toAppError) as T) : out;
  } catch (e) {
    return toAppError(e);
  }
};

/**
 * The vendored engine reads and writes by id and knows nothing of accounts, so ownership is
 * checked here, through the creator's own repositories, before any id reaches it. A run or
 * rehearsal that belongs to someone else reads exactly like one that does not exist.
 */
export function rehearsalRoutes(app: AppServices) {
  const svc = rehearsalService({ db: app.db, background: (job) => app.jobs.enqueue('rehearsal', async () => job()) });
  const ownRun = (ctx: AppContext, id: string) => {
    if (!ctx.repos.runs.findById(id)) throw new AppError(404, ErrorCode.NOT_FOUND, 'Run not found.');
  };
  return router()
    .get('/rehearsal/config', (c) => c.json(svc.config()))
    .get('/runs/:id/rehearsal', validate('param', IdParam), (c) => {
      const { id } = c.req.valid('param');
      // same shape as "no rehearsal yet", so the Audience tab needs no special case
      if (!c.var.ctx.repos.runs.findById(id)) return c.json({ ...svc.config(), rehearsal: null });
      return c.json(guard(() => svc.get(id)));
    })
    .post('/runs/:id/rehearsal', validate('param', IdParam), validate('json', StartInput), (c) => {
      const { id } = c.req.valid('param');
      ownRun(c.var.ctx, id);
      return c.json(guard(() => svc.start(id, c.req.valid('json'))), 202);
    })
    .post('/rehearsals/:id/interview', validate('param', IdParam), validate('json', InterviewInput), async (c) => {
      const { id } = c.req.valid('param');
      if (!c.var.ctx.repos.runs.ownsRehearsal(id)) throw new AppError(404, ErrorCode.NOT_FOUND, 'Rehearsal not found.');
      return c.json(await guard(() => svc.interview(id, c.req.valid('json'))));
    });
}
