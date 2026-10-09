import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { IdParam } from '../archive/archive.schemas.ts';
import { DecisionInput, NoteInput, PostedInput, PublishConfirmInput } from './decisions.schemas.ts';
import { addNote, decide, markPosted, publishConfirm } from './decisions.service.ts';

export function decisionsRoutes() {
  const draftId = validate('param', IdParam);
  return router()
    .post('/drafts/:id/decision', draftId, validate('json', DecisionInput), async (c) => c.json(await decide(c.var.ctx, c.req.valid('param').id, c.req.valid('json'))))
    .post('/drafts/:id/publish-confirm', draftId, validate('json', PublishConfirmInput), (c) => c.json(publishConfirm(c.var.ctx, c.req.valid('param').id, c.req.valid('json'))))
    .post('/drafts/:id/posted', draftId, validate('json', PostedInput), (c) => c.json(markPosted(c.var.ctx, c.req.valid('param').id, c.req.valid('json'))))
    .post('/drafts/:id/note', draftId, validate('json', NoteInput), (c) => c.json(addNote(c.var.ctx, c.req.valid('param').id, c.req.valid('json'))));
}
