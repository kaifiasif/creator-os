// Integration and end-to-end API tests against the real app on an in-memory database.
import assert from 'node:assert/strict';
import { before, beforeEach, test } from 'node:test';
import type { Claim } from '../src/domain/types.ts';
import { assignCondition } from '../src/modules/runs/condition.ts';
import { localEmbed } from '../src/providers/embeddings.ts';
import { localLlm } from '../src/providers/llm.local.ts';
import { createHarness, fixture, importSampleArchive, type Json } from './helpers.ts';

const h = createHarness();
const { api, readySource, runFor, ctx } = h;

before(async () => {
  const imported = await importSampleArchive(h);
  assert.equal(imported.threads_grouped, 1);
});
beforeEach(() => h.reset());

test('archive import is idempotent, holds out a seeded share, and warns below 20 pieces', async () => {
  const again = await api('POST', '/api/archive/import', JSON.parse(await fixture('sample-archive.json')));
  assert.equal(again.body.imported, 0);
  assert.ok(again.body.skipped_existing > 0);
  const list = (await api('GET', '/api/archive')).body;
  assert.ok(list.holdout > 0 && list.holdout < list.total / 2);

  const small = createHarness();
  const r = await small.api('POST', '/api/archive/import', { items: [{ text: 'just one post' }] });
  assert.match(r.body.warning, /at least 20/);
});

test('ingest → speaker map → claims with verified quotes; non-creator marked', async () => {
  const id = await readySource('call', await fixture('call-with-mentor.txt'), { kind: 'call', consent_confirmed: true });
  let source = (await api('GET', `/api/sources/${id}`)).body;
  assert.equal(source.status, 'mapping');
  const early = await api('POST', '/api/runs', { source_item_id: id });
  assert.equal(early.status, 409);
  assert.equal(early.body.error.code, 'INVALID_STATE');

  await api('POST', `/api/sources/${id}/speaker-map`, { creator_speaker: 'Kaifi' });
  await h.settle();
  source = (await api('GET', `/api/sources/${id}`)).body;
  assert.equal(source.status, 'ready');
  for (const c of source.claims) assert.equal(source.transcript_text.slice(c.char_start, c.char_end), c.quote);
  const priya = source.claims.find((c: Json) => !c.is_creator && c.speaker === 'Priya');
  assert.ok(priya);
  assert.equal(typeof priya.is_creator, 'boolean');
  const notCreator = await api('POST', '/api/runs', { source_item_id: id, angle_claim_ids: [priya.id] });
  assert.equal(notCreator.status, 422);
  assert.equal(notCreator.body.error.code, 'RULE_VIOLATION');
});

test('calls need consent; duplicates are detected; bad input is rejected with a stable code', async () => {
  const text = 'A [00:01]: one two three four five six.\nB [00:02]: seven eight nine ten eleven.';
  const noConsent = await api('POST', '/api/sources', { kind: 'call', text });
  assert.equal(noConsent.status, 422);
  assert.equal(noConsent.body.error.code, 'CONSENT_REQUIRED');

  await readySource('dup', 'Unique note about duplicate detection in this flow, with enough words.');
  const dup = await api('POST', '/api/sources', { text: 'Unique  note about duplicate detection in this flow, with enough words.' });
  assert.equal(dup.status, 409);
  assert.equal(dup.body.error.code, 'DUPLICATE_SOURCE');
  assert.ok(dup.body.error.details.existing_source_item_id);

  const empty = await api('POST', '/api/sources', {});
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.code, 'VALIDATION_FAILED');
  assert.equal((await api('GET', '/api/sources/missing')).body.error.code, 'NOT_FOUND');
});

test('multipart upload: unsupported file types are refused', async () => {
  const form = new FormData();
  form.set('file', new Blob(['%PDF-1.7']), 'deck.pdf');
  const res = await h.request('/api/sources', { method: 'POST', body: form });
  assert.equal(res.status, 400);
  assert.equal(((await res.json()) as Json).error.code, 'UNSUPPORTED_FILE');
});

test('model claims whose quotes do not verify are dropped and logged', async () => {
  ctx.providers.llm = {
    ...localLlm,
    extractClaims: async () => [
      { segment: 0, quote: 'Every migration teaches you something new about caching layers', text: 'ok' },
      { segment: 0, quote: 'This sentence was never said by anyone at all', text: 'invented' },
    ],
  };
  const id = await readySource('fake', 'Every migration teaches you something new about caching layers and data.');
  const source = (await api('GET', `/api/sources/${id}`)).body;
  assert.equal(source.claims.length, 1);
  assert.equal(source.extraction_log.dropped.length, 1);
});

test('a source with no creator claims is nothing postable', async () => {
  const id = await readySource('chat', 'A: Okay sounds good to me.\nB: Yes.\nA: Sure?');
  assert.equal((await api('GET', `/api/sources/${id}`)).body.status, 'mapping');
  await api('POST', `/api/sources/${id}/speaker-map`, { creator_speaker: 'B' });
  await h.settle();
  assert.equal((await api('GET', `/api/sources/${id}`)).body.status, 'nothing_postable');
});

test('gate flags a planted unsupported sentence and an archive duplicate; accept is blocked until resolved', async () => {
  ctx.config.forcedCondition = 'gate';
  const id = await readySource('memo', await fixture('voice-memo.txt'));
  const claims: Claim[] = (await api('GET', `/api/sources/${id}`)).body.claims;
  ctx.providers.llm = {
    ...localLlm,
    generateDraft: async ({ claims: cs }) => [
      {
        sentences: [
          { text: cs[0].text, type: 'assertion', supports: [cs[0].id] },
          { text: 'This approach cut my review time by 73 percent across 40 posts.', type: 'assertion', supports: [cs[0].id] },
          { text: 'Shipping small is not about speed, it is about being wrong in smaller pieces.', type: 'assertion', supports: [cs[1].id] },
          { text: 'Nobody reads the docs anyway.', type: 'assertion', supports: [] },
        ],
      },
    ],
  };
  const lead = claims.find((c) => c.is_creator)!;
  const run = await runFor(id, { angle_claim_ids: [lead.id, claims[1].id] });
  assert.equal(run.status, 'in_review');
  assert.equal(run.condition, null, 'condition hidden before decision');
  const sentences: Json[] = run.draft.posts.flatMap((p: Json) => p.sentences);
  const byText = (t: string) => sentences.find((s) => s.text.startsWith(t));
  assert.equal(byText('This approach').checks.traceability.status, 'unsupported');
  assert.equal(byText('Nobody reads').checks.traceability.status, 'unsupported');
  assert.equal(byText('Shipping small').checks.repetition.flag, true);
  assert.ok(byText('Shipping small').checks.repetition.matches[0].published_at);

  const blocked = await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'accept' });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.error.code, 'UNRESOLVED_FLAGS');
  assert.equal(blocked.body.error.details.unresolved.length, 3);

  // fix: remove the unsupported sentences, override the repetition as an intentional callback
  const keep = sentences.filter((s) => !/^(This approach|Nobody reads)/.test(s.text)).map((s) => s.text).join(' ');
  const ok = await api('POST', `/api/drafts/${run.draft.id}/decision`, {
    decision: 'edit_then_accept',
    final_posts: [keep],
    overrides: [{ sentence_id: byText('Shipping small').id, reason: 'intentional callback to March post' }],
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.condition, 'gate');
  assert.equal(ok.body.recheck_status, 'clean', JSON.stringify(ok.body.recheck));
  assert.ok(ok.body.edit_ratio > 0);
});

test('e2e: edit adds an unsourced number → publish blocked → fix → typed confirm → posted; edit after confirm invalidates', async () => {
  ctx.config.forcedCondition = 'gate';
  const id = await readySource('notes', await fixture('rough-notes.md'));
  const run = await runFor(id, { format: 'post' });
  assert.equal(run.status, 'in_review', run.error);
  const draft = run.draft;
  const overrides = draft.posts
    .flatMap((p: Json) => p.sentences)
    .filter((s: Json) => s.blocking)
    .map((s: Json) => ({ sentence_id: s.id, reason: 'checked by hand' }));
  const original: string[] = draft.posts.map((p: Json) => p.text);
  const decide = (body: unknown) => api('POST', `/api/drafts/${draft.id}/decision`, body);
  const confirm = (text_hash: string, typed_confirmation = 'POST') => api('POST', `/api/drafts/${draft.id}/publish-confirm`, { text_hash, typed_confirmation });

  const d1 = await decide({ decision: 'edit_then_accept', final_posts: [`${original[0]} It made the page 40 percent faster.`], overrides });
  assert.equal(d1.status, 200, JSON.stringify(d1.body));
  assert.equal(d1.body.recheck_status, 'flagged');
  assert.equal((await confirm(d1.body.text_hash)).status, 409);

  const d2 = await decide({ decision: 'edit_then_accept', final_posts: original });
  assert.equal(d2.body.recheck_status, 'clean', JSON.stringify(d2.body.recheck));
  assert.equal((await confirm(d2.body.text_hash, 'post')).status, 422);
  const stale = await confirm('stale');
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error.code, 'TEXT_CHANGED');
  const c2 = await confirm(d2.body.text_hash);
  assert.equal(c2.status, 200);
  assert.match(c2.body.compose_url, /^https:\/\/x\.com\/intent\/post\?text=/);

  const d3 = await decide({ decision: 'edit_then_accept', final_posts: [original[0].replace(/\.$/, '!')] });
  assert.equal(d3.status, 200);
  assert.equal((await api('POST', `/api/drafts/${draft.id}/posted`, {})).status, 409);
  assert.equal((await confirm(d3.body.text_hash)).status, 200);
  assert.equal((await api('POST', `/api/drafts/${draft.id}/posted`, { url: 'https://example.com/x' })).status, 400);
  assert.equal((await api('POST', `/api/drafts/${draft.id}/posted`, { url: 'https://x.com/kaifi/status/1' })).status, 200);
  assert.equal((await decide({ decision: 'reject', reject_reason: 'other' })).status, 409);
});

test('context_only: checks hidden and not enforced before the decision, revealed after', async () => {
  ctx.config.forcedCondition = 'context_only';
  const id = await readySource('ctx', 'Every confused click is a bug report the customer will never file. Customers rarely read release notes at all, they just notice changes.');
  const run = await runFor(id);
  assert.equal(run.checks_visible, false);
  assert.ok(run.draft.posts.every((p: Json) => p.sentences.every((s: Json) => s.checks === null)));
  assert.equal(run.draft.voice, null);
  const d = await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'accept' });
  assert.equal(d.status, 200);
  assert.equal(d.body.condition, 'context_only');
  const after = (await api('GET', `/api/runs/${run.run_id}`)).body;
  assert.equal(after.checks_visible, true);
  assert.ok(after.draft.posts[0].sentences[0].checks.traceability);
});

test('reject needs a reason; the dashboard is locked while a draft awaits a decision', async () => {
  ctx.config.forcedCondition = 'gate';
  const id = await readySource('lock', 'Most dashboards are read once and then ignored by the whole team for months.');
  const run = await runFor(id, { format: 'post' });
  const locked = (await api('GET', '/api/metrics/acceptance')).body;
  assert.equal(locked.locked, true);
  assert.ok(locked.pending_runs.some((r: Json) => r.id === run.run_id));
  const csvLocked = await api('GET', '/api/metrics/export.csv');
  assert.equal(csvLocked.status, 409);
  assert.equal(csvLocked.body.error.code, 'METRICS_LOCKED');

  const noReason = await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'reject' });
  assert.equal(noReason.status, 400);
  assert.equal(noReason.body.error.details.fields[0].path, 'reject_reason');
  assert.equal((await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'reject', reject_reason: 'repeat', reject_note: 'said it in March' })).status, 200);

  const open = (await api('GET', '/api/metrics/acceptance')).body;
  assert.equal(open.locked, false);
  assert.ok(open.by_condition.gate.n >= 1);
  assert.ok(open.rejections.total >= 1);
  assert.match((await api('GET', '/api/metrics/export.csv')).body, /^run_id,created_at,condition/);
});

test('fail closed: an embeddings outage during the gate → gate_failed, accept refused, retry recovers', async () => {
  ctx.config.forcedCondition = 'gate';
  const id = await readySource('outage', 'Server components made me rethink where data lives in the app entirely.');
  let down = true;
  ctx.providers.embeddings = {
    name: 'local-hash-512',
    defaultThreshold: 0.6,
    embed: async (texts) => {
      if (down) throw new Error('embeddings 503');
      return texts.map(localEmbed);
    },
  };
  const run = await runFor(id, { format: 'post' });
  assert.equal(run.status, 'gate_failed');
  assert.match(run.error, /embeddings 503/);
  assert.equal((await api('POST', `/api/drafts/${run.draft.id}/decision`, { decision: 'accept' })).status, 409);
  down = false;
  const retry = await api('POST', `/api/runs/${run.run_id}/retry`);
  assert.equal(retry.status, 202);
  assert.equal(retry.body.status, 'in_review');
  await h.settle();
});

test('a provider failure during generation → run failed with its error stored, no draft', async () => {
  const id = await readySource('genfail', 'Accessibility bugs ship at the start of a project, not at the end of it.');
  ctx.providers.llm = {
    ...localLlm,
    generateDraft: async () => {
      throw new Error('Anthropic 529 overloaded');
    },
  };
  const run = await runFor(id);
  assert.equal(run.status, 'failed');
  assert.match(run.error, /529/);
  assert.equal(run.draft, null);
});

test('retired angle memory flags at high severity, and the ablation toggle turns it off', async () => {
  ctx.config.forcedCondition = 'gate';
  const id = await readySource('retired', 'Feature flags let me ship work nobody notices, which is exactly the goal of a quiet launch.');
  const { claims } = (await api('GET', `/api/sources/${id}`)).body;
  assert.equal((await api('POST', `/api/claims/${claims[0].id}/retire`, { reason: 'done saying this' })).status, 200);
  const on = await runFor(id, { format: 'post', memory_enabled: true });
  assert.equal(on.draft.posts[0].sentences[0].checks.repetition.severity, 'high');
  const off = await runFor(id, { format: 'post', memory_enabled: false });
  assert.equal(off.draft.posts[0].sentences[0].checks.repetition.retired_match, null);
});

test('conditions are balanced in seeded blocks and reproducible', () => {
  const conditions = Array.from({ length: 24 }, (_, i) => assignCondition(i, 7).condition);
  assert.equal(conditions.filter((c) => c === 'gate').length, 12);
  assert.deepEqual(conditions, Array.from({ length: 24 }, (_, i) => assignCondition(i, 7).condition));
  assert.equal(assignCondition(0, 7, 'context_only').condition, 'context_only');
});

test('unknown endpoints and missing sessions return the standard error shape', async () => {
  const missing = await api('GET', '/api/nope');
  assert.deepEqual(missing.body, { error: { code: 'NOT_FOUND', message: 'No such endpoint.' } });
  const locked = await h.app.request('/api/runs');
  assert.equal(locked.status, 401);
  assert.equal(((await locked.json()) as Json).error.code, 'UNAUTHORIZED');
  assert.equal((await h.app.request('/api/health')).status, 200, 'health stays public');
});

