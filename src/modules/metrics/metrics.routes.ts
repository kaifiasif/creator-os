import { router } from '../../http/types.ts';
import { validate } from '../../http/validate.ts';
import { acceptance, exportCsv } from './acceptance.service.ts';
import { calibrationPairs, fitThreshold, saveLabels } from './calibration.service.ts';
import { drift } from './drift.service.ts';
import { LabelsInput } from './metrics.schemas.ts';

export function metricsRoutes() {
  return router()
    .get('/metrics/acceptance', (c) => c.json(acceptance(c.var.ctx)))
    .get('/metrics/drift', async (c) => c.json(await drift(c.var.ctx)))
    .get('/metrics/export.csv', (c) =>
      c.body(exportCsv(c.var.ctx), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="creator-os-decisions.csv"' }))
    .get('/calibration/pairs', (c) => c.json(calibrationPairs(c.var.ctx)))
    .post('/calibration/labels', validate('json', LabelsInput), (c) => c.json(saveLabels(c.var.ctx, c.req.valid('json').labels)))
    .post('/calibration/fit', (c) => c.json(fitThreshold(c.var.ctx)));
}
