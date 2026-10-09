import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { ArchiveImportInput, IdParam, RetireInput } from './archive.schemas.ts';
import { importArchive, listArchive, previewArchive, retireAngle, unretirePiece } from './archive.service.ts';

export function archiveRoutes() {
  return router()
    .get('/archive', (c) => c.json(listArchive(c.var.ctx)))
    .post('/archive/preview', validate('json', ArchiveImportInput), (c) => c.json(previewArchive(c.var.ctx, c.req.valid('json'))))
    .post('/archive/import', validate('json', ArchiveImportInput), async (c) => c.json(await importArchive(c.var.ctx, c.req.valid('json'))))
    .post('/archive/:id/retire', validate('param', IdParam), validate('json', RetireInput), async (c) =>
      c.json(await retireAngle(c.var.ctx, { pieceId: c.req.valid('param').id }, c.req.valid('json'))),
    )
    .delete('/archive/:id/retire', validate('param', IdParam), (c) => c.json(unretirePiece(c.var.ctx, c.req.valid('param').id)))
    .post('/claims/:id/retire', validate('param', IdParam), validate('json', RetireInput), async (c) =>
      c.json(await retireAngle(c.var.ctx, { claimId: c.req.valid('param').id }, c.req.valid('json'))),
    );
}
