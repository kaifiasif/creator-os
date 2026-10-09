import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { IdParam } from '../archive/archive.schemas.ts';
import { SettingsInput } from './agents.schemas.ts';
import { agentSettings, retryAgents, saveAgentSettings } from './agents.service.ts';

export function agentsRoutes() {
  return router()
    .post('/runs/:id/agents', validate('param', IdParam), (c) => c.json(retryAgents(c.var.ctx, c.req.valid('param').id), 202))
    .get('/settings', (c) => c.json(agentSettings(c.var.ctx)))
    .post('/settings', validate('json', SettingsInput), (c) => c.json(saveAgentSettings(c.var.ctx, c.req.valid('json'))));
}
