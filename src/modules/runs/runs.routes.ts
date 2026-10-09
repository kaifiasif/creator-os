import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { IdParam } from '../archive/archive.schemas.ts';
import { CreateRunInput } from './runs.schemas.ts';
import { createRun, getRun, listRuns, retryRun } from './runs.service.ts';

export function runsRoutes() {
  return router()
    .get('/runs', (c) => c.json(listRuns(c.var.ctx)))
    .post('/runs', validate('json', CreateRunInput), async (c) => c.json(await createRun(c.var.ctx, c.req.valid('json')), 202))
    .get('/runs/:id', validate('param', IdParam), (c) => c.json(getRun(c.var.ctx, c.req.valid('param').id)))
    .post('/runs/:id/retry', validate('param', IdParam), async (c) => c.json(await retryRun(c.var.ctx, c.req.valid('param').id), 202));
}
