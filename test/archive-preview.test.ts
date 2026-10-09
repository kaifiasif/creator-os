// Archive preview: parse without saving, then import only the rows the creator kept.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHarness } from './helpers.ts';

const tweets = (list: [string, string, string?][]) =>
  `window.YTD.tweets.part0 = ${JSON.stringify(
    list.map(([id, text, reply]) => ({ tweet: { id_str: id, full_text: text, created_at: 'Mon Mar 02 10:00:00 +0000 2026', in_reply_to_status_id_str: reply ?? null } })),
  )}`;

test('preview lists new, existing, threads and left-out rows; import honours "only"', async () => {
  const h = createHarness();
  const { api } = h;
  const raw = tweets([
    ['1', 'Shipping on Fridays is fine if rollback takes one click.'],
    ['2', 'Most code review comments are about taste, not bugs.'],
    ['3', 'RT @someone: great thread'],
    ['4', 'Write the test that would have caught the last outage.'],
    ['5', 'And then measure it.', '4'],
    ['6', 'Replying to a stranger here.', '999'],
  ]);
  const preview = (await api('POST', '/api/archive/preview', { format: 'x_export', raw })).body;
  assert.equal(preview.counts.rows, 3);
  assert.equal(preview.counts.new, 3);
  assert.equal(preview.counts.threads, 1);
  assert.deepEqual(preview.excluded.map((e: { reason: string }) => e.reason).sort(), ['reply', 'retweet']);
  assert.equal((await h.user()).repos.archive.count(), 0, 'preview must not save');

  const imported = (await api('POST', '/api/archive/import', { format: 'x_export', raw, only: ['1', '4'] })).body;
  assert.equal(imported.imported, 2);
  const again = (await api('POST', '/api/archive/preview', { format: 'x_export', raw })).body;
  assert.equal(again.counts.exists, 2);
  assert.equal(again.rows.find((x: { external_id: string }) => x.external_id === '2').status, 'new');
});

test('import without items or raw text is a validation error', async () => {
  const { api } = createHarness();
  const r = await api('POST', '/api/archive/import', { format: 'paste' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'VALIDATION_FAILED');
});
