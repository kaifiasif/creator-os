import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/db/client.ts';
import { migrate } from '../src/db/migrate.ts';
import { wilson } from '../src/domain/stats.ts';
import { editRatio, numbersIn, packSentences, xLength } from '../src/domain/text.ts';
import type { Decision } from '../src/domain/types.ts';
import { groupThreads, parseXExport } from '../src/modules/archive/import-parsers.ts';
import { checkChannel } from '../src/modules/checks/channel.ts';
import { effectiveType } from '../src/modules/checks/traceability.ts';
import { classifyOutcome } from '../src/modules/decisions/outcome.ts';
import { bestThreshold } from '../src/modules/metrics/calibration.service.ts';
import { classifyIntake } from '../src/modules/sources/intake.ts';
import { locateQuote } from '../src/modules/sources/quote-locator.ts';
import { generateDraftPrompt } from '../src/prompts/index.ts';
import { parseTextTranscript } from '../src/providers/transcription.ts';

test('edit ratio: identical 0, full replacement 1, punctuation-only < 0.02', () => {
  const a = 'Shipping small is not about speed. It is about being wrong in smaller pieces.';
  assert.equal(editRatio(a, a), 0);
  assert.equal(editRatio('alpha beta gamma', 'delta epsilon zeta'), 1);
  assert.ok(editRatio(a, a.replace('speed.', 'speed!')) < 0.02);
  assert.ok(editRatio(a, a.replace('speed. It', 'speed, it')) < 0.02);
});

test('quote verification: exact, whitespace differences, and misses', () => {
  const seg = 'The real problem is that fluent  sentences are the dangerous ones.';
  assert.deepEqual(locateQuote(seg, 'The real problem'), { start: 0, end: 16 });
  const ws = locateQuote(seg, 'fluent sentences are');
  assert.ok(ws);
  assert.equal(seg.slice(ws.start, ws.end), 'fluent  sentences are');
  assert.equal(locateQuote(seg, 'clunky sentences are'), null);
  assert.equal(locateQuote(seg, 'he real problem is that fluent sentences are the dangerous ones!'), null);
});

test('X character counting: URLs count 23, emoji count 2', () => {
  assert.equal(xLength('hello'), 5);
  assert.equal(xLength('see https://example.com/a/very/long/path/that/goes/on'), 4 + 23);
  assert.equal(xLength('ship it 🚀'), 8 + 2);
});

test('thread splitter keeps each post within the limit', () => {
  const sentences = Array.from({ length: 12 }, (_, i) => ({ text: `Sentence number ${i} has a handful of words to fill some space here.` }));
  const posts = packSentences(sentences);
  assert.ok(posts.length > 1);
  for (const p of posts) assert.ok(xLength(p.map((x) => x.text).join(' ')) <= 280);
});

test('channel rules flag length, broken mentions, links and numbering', () => {
  const [ok, long, bad] = checkChannel(['1/ fine post @kaifi', 'x'.repeat(300), '5/ see @ and http://nohost and [a](b)']);
  assert.equal(ok.ok, true);
  assert.equal(long.ok, false);
  assert.equal(bad.issues.length, 4);
});

test('Wilson 95% interval matches known values', () => {
  assert.deepEqual(wilson(9, 12), [0.47, 0.91]);
  assert.deepEqual(wilson(5, 12), [0.19, 0.68]);
  assert.deepEqual(wilson(0, 0), [0, 0]);
});

test('numbers inside words are not numbers', () => {
  assert.deepEqual(numbersIn('SDE3 moved 14 bugs, 3.5% faster'), ['14', '3.5%']);
});

test('a "connective" carrying facts is treated as an assertion', () => {
  assert.equal(effectiveType({ type: 'connective', text: 'Here is what I mean.' }), 'connective');
  assert.equal(effectiveType({ type: 'connective', text: 'It took 11 days.' }), 'assertion');
});

test('outcome classification', () => {
  const t = (s: number) => new Date(Date.UTC(2026, 9, 1, 0, 0, s)).toISOString();
  const decision = (d: Partial<Decision>): Decision => ({
    id: 'd', draft_id: 'x', decision: 'accept', reject_reason: null, reject_note: null, final_posts: null, final_text: null, text_hash: null,
    edit_ratio: null, claim_set_changed: false, overrides: [], recheck: null, recheck_status: null, assist: null, time_to_decision_ms: null, decided_at: t(0), ...d,
  });
  const none = { confirmed_at: null };
  assert.equal(classifyOutcome(none, [decision({ edit_ratio: 0.05 })]), 'light_accept');
  assert.equal(classifyOutcome(none, [decision({ decision: 'edit_then_accept', edit_ratio: 0.3 })]), 'substantive_rewrite');
  assert.equal(classifyOutcome(none, [decision({ edit_ratio: 0.05, claim_set_changed: true })]), 'substantive_rewrite');
  const reject = decision({ decision: 'reject' });
  assert.equal(classifyOutcome({ confirmed_at: t(90) }, [reject, decision({ decision: 'edit_then_accept', edit_ratio: 0.1, decided_at: t(60) })]), 'rejected_fixed');
  assert.equal(classifyOutcome(none, [reject], Date.parse(t(0)) + 49 * 3600e3), 'abandoned');
  assert.equal(classifyOutcome(none, [reject], Date.parse(t(0)) + 3600e3), 'rejected_pending');
  assert.equal(classifyOutcome(none, []), 'pending');
});

test('threshold calibration maximises F1', () => {
  const labels = [0.9, 0.85, 0.8].map((similarity) => ({ similarity, same_angle: true })).concat([0.7, 0.5, 0.82].map((similarity) => ({ similarity, same_angle: false })));
  assert.deepEqual(bestThreshold(labels), { threshold: 0.8, f1: 0.857 });
});

test('gate prompt contains no archive text; context_only prompt does', () => {
  const claims = [{ id: 'c1', is_creator: true, speaker: 'Me', text: 'Every confused click is a bug report.' }];
  const examples = [{ id: 'p1', text: 'ARCHIVE SENTINEL: a good abstraction is one you can delete.' }];
  const base = { claims, leadClaimId: 'c1', format: 'post' as const, voiceSummary: { mean_sentence_words: 11 }, examples, customAngle: null };
  const gate = generateDraftPrompt({ ...base, condition: 'gate' });
  const ctx = generateDraftPrompt({ ...base, condition: 'context_only' });
  assert.ok(!JSON.stringify(gate).includes('ARCHIVE SENTINEL'));
  assert.ok(JSON.stringify(ctx).includes('ARCHIVE SENTINEL'));
  // everything outside the style block is identical across conditions
  assert.equal(gate.system, ctx.system);
  assert.equal(gate.user.split('Claims (id')[1], ctx.user.split('Claims (id')[1]);
});

test('transcript parsing: speaker lines with timestamps, and plain notes by paragraph', () => {
  const t = parseTextTranscript('Kaifi [00:10]: Hello there friend.\nPriya [00:20]: Hi.\ncontinued line');
  assert.deepEqual(t.speakers, ['Kaifi', 'Priya']);
  assert.equal(t.segments[0].start_ms, 10000);
  assert.equal(t.segments[1].text, 'Hi. continued line');
  assert.equal(t.transcript_text.slice(t.segments[1].char_start, t.segments[1].char_end), 'Hi. continued line');
  const notes = parseTextTranscript('First para line one\nline two.\n\nSecond para.');
  assert.equal(notes.segments.length, 2);
  assert.equal(notes.speakers.length, 1);
});

test('X export: threads grouped, retweets and replies to others excluded', () => {
  const raw = `window.YTD.tweets.part0 = ${JSON.stringify([
    { tweet: { id_str: '1', full_text: 'Thread start', created_at: 'Wed Oct 10 20:19:24 +0000 2026' } },
    { tweet: { id_str: '2', full_text: 'Thread part 2', in_reply_to_status_id_str: '1', created_at: 'Wed Oct 10 20:20:24 +0000 2026' } },
    { tweet: { id_str: '3', full_text: 'RT @someone: hi', created_at: 'Wed Oct 10 20:20:24 +0000 2026' } },
    { tweet: { id_str: '4', full_text: '@other agreed', in_reply_to_status_id_str: '999', created_at: 'Wed Oct 10 20:20:24 +0000 2026' } },
  ])}`;
  const { pieces, excluded, threadsGrouped } = groupThreads(parseXExport(raw) as Parameters<typeof groupThreads>[0]);
  assert.equal(pieces.length, 1);
  assert.deepEqual(pieces[0].parts, ['Thread start', 'Thread part 2']);
  assert.equal(excluded, 2);
  assert.equal(threadsGrouped, 1);
});

test('upload intake: medium, size limits, unsupported types and contents that do not match the name', () => {
  const file = (filename: string, data: Uint8Array) => ({ filename, contentType: '', data });
  const bytes = (head: string, size = 16) => {
    const data = new Uint8Array(size).fill(0x20);
    data.set(new TextEncoder().encode(head));
    return data;
  };
  assert.equal(classifyIntake({ file: file('memo.m4a', bytes('\0\0\0\x18ftypM4A ')) }).medium, 'audio');
  assert.equal(classifyIntake({ file: file('memo.ogg', bytes('OggS')) }).medium, 'audio');
  assert.equal(classifyIntake({ file: file('notes.md', bytes('# notes')) }).medium, 'text');
  assert.throws(() => classifyIntake({ file: file('notes.md', bytes('x', 200 * 1024)) }), { code: 'PAYLOAD_TOO_LARGE' });
  assert.throws(() => classifyIntake({ file: file('deck.pdf', bytes('%PDF')) }), { code: 'UNSUPPORTED_FILE' });
  // a renamed binary is refused before it is stored
  assert.throws(() => classifyIntake({ file: file('memo.mp3', bytes('%PDF-1.7')) }), { code: 'UNSUPPORTED_FILE' });
  assert.throws(() => classifyIntake({ file: file('notes.txt', new Uint8Array([0x48, 0x00, 0xff, 0xfe])) }), { code: 'UNSUPPORTED_FILE' });
  assert.throws(() => classifyIntake({ text: '   ' }), { code: 'VALIDATION_FAILED' });
});

test('schema invariants: the database itself refuses impossible rows', () => {
  const db = openDatabase(':memory:');
  migrate(db);
  const now = new Date().toISOString();
  // a call without consent
  assert.throws(() =>
    db.run(
      "INSERT INTO source_items (id, title, kind, content_hash, mime, status, transcript_text, consent_confirmed, created_at) VALUES ('s1', 't', 'call', 'h', 'text/plain', 'transcribing', 'x', 0, ?)",
      now,
    ),
  );
  // a legacy database without migrations is refused with instructions
  const legacy = openDatabase(':memory:');
  legacy.exec('CREATE TABLE source_items (id TEXT)');
  assert.throws(() => migrate(legacy), /Creator OS 0.4 or earlier/);
});
