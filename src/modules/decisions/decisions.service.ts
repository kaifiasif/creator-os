/** FR-006 decisions, re-check of the final text, the typed publish confirmation, and the posted marker. FR-014 notes. */
import type { AppContext } from '../../context.ts';
import { conflict, ErrorCode, notFound, unprocessable } from '../../core/errors.ts';
import { nowIso, uuidv7 } from '../../domain/ids.ts';
import { composeUrl, editRatio, sha256 } from '../../domain/text.ts';
import type { Decision, Draft, DraftSentence, Override, Run } from '../../domain/types.ts';
import { hasChecks } from '../agents/tools.ts';
import { isBlocking, runGate } from '../checks/gate.ts';
import { mapFinalSentences, postTexts } from '../checks/sentence-mapping.ts';
import type { DecisionInput } from './decisions.schemas.ts';
import { latestAccept } from './outcome.ts';

const PUBLISH_WORD = 'POST';
const DECIDABLE: Run['status'][] = ['in_review', 'decided', 'gate_failed'];

interface DraftBundle {
  draft: Draft;
  run: Run;
  sentences: DraftSentence[];
  decisions: Decision[];
}

function load(ctx: AppContext, draftId: string): DraftBundle {
  const draft = ctx.repos.drafts.findById(draftId);
  if (!draft) throw notFound('Draft');
  const run = ctx.repos.runs.findById(draft.run_id);
  if (!run) throw notFound('Run');
  return { draft, run, sentences: ctx.repos.drafts.sentences(draftId), decisions: ctx.repos.decisions.listForDraft(draftId) };
}

/** Saves a decision and invalidates any earlier publish confirmation, atomically. */
function record(ctx: AppContext, run: Run, decision: Decision): void {
  ctx.db.transaction(() => {
    ctx.repos.decisions.insert(decision);
    ctx.repos.drafts.clearConfirmation(decision.draft_id);
    ctx.repos.runs.setStatus(run.id, 'decided', run.error);
  });
}

const timeToDecision = (run: Run, first: boolean, now: string) => (first && run.ready_at ? Date.parse(now) - Date.parse(run.ready_at) : null);

function assertOverridesKnown(overrides: Override[], sentences: DraftSentence[]): void {
  const known = new Set(sentences.map((s) => s.id));
  const unknown = overrides.find((o) => o.sentence_id && !known.has(o.sentence_id));
  if (unknown) throw unprocessable(`Unknown sentence ${unknown.sentence_id}.`);
}

export async function decide(ctx: AppContext, draftId: string, input: DecisionInput) {
  const { draft, run, sentences, decisions } = load(ctx, draftId);
  if (draft.posted_at) throw conflict('This draft is already marked as posted.');
  if (!DECIDABLE.includes(run.status)) throw conflict(`Run is ${run.status}.`, { status: run.status });
  assertOverridesKnown(input.overrides, sentences);
  const first = decisions.length === 0;
  const now = nowIso();
  const base = {
    id: uuidv7(),
    draft_id: draftId,
    overrides: input.overrides,
    time_to_decision_ms: timeToDecision(run, first, now),
    decided_at: now,
  };

  if (input.decision === 'reject') {
    if (decisions.some((d) => d.decision === 'reject')) throw conflict('This draft is already rejected.');
    record(ctx, run, {
      ...base,
      decision: 'reject',
      reject_reason: input.reject_reason,
      reject_note: input.reject_note || null,
      final_posts: null,
      final_text: null,
      text_hash: null,
      edit_ratio: null,
      claim_set_changed: null,
      recheck: null,
      recheck_status: null,
      assist: null,
    });
    return { decision_id: base.id, decision: 'reject' as const, condition: run.condition };
  }

  if (draft.gate_status === 'gate_failed') throw conflict('Checks could not run on this draft, so it cannot be accepted. Retry the checks first.');
  const original = postTexts(sentences);
  const finalPosts = (input.final_posts?.length ? input.final_posts : original).map((p) => p.trim()).filter(Boolean);
  if (!finalPosts.length) throw unprocessable('The final text is empty.');
  const changed = finalPosts.join('\n\n') !== original.join('\n\n');
  const decision = input.decision === 'accept' && changed ? 'edit_then_accept' : input.decision;

  const allOverrides = [...decisions.flatMap((d) => d.overrides), ...input.overrides];
  const overriddenIds = new Set(allOverrides.flatMap((o) => (o.sentence_id ? [o.sentence_id] : [])));
  const overriddenText = new Set([
    ...allOverrides.flatMap((o) => (o.sentence_text ? [o.sentence_text] : [])),
    ...sentences.filter((s) => overriddenIds.has(s.id)).map((s) => s.text),
  ]);
  const mapped = mapFinalSentences(finalPosts, sentences);

  // Gate condition, before a decision exists: blocking flags on sentences kept verbatim stop the accept.
  if (run.condition === 'gate' && first) {
    const byId = new Map(sentences.map((s) => [s.id, s]));
    const unresolved = mapped
      .filter((m) => m.unchanged && m.from_sentence_id)
      .flatMap((m) => byId.get(m.from_sentence_id!) ?? [])
      .filter((s) => hasChecks(s.checks) && isBlocking(s.checks) && !overriddenIds.has(s.id));
    if (unresolved.length) {
      throw conflict(
        'Some flagged sentences are still unresolved. Edit, remove, or override them with a reason.',
        { unresolved: unresolved.map((s) => ({ sentence_id: s.id, text: s.text })) },
        ErrorCode.UNRESOLVED_FLAGS,
      );
    }
  }

  const gate = await runGate(ctx, { sourceItemId: run.source_item_id, sentences: mapped, posts: finalPosts, memoryEnabled: run.memory_enabled });
  const rechecked = mapped.map((m) => ({ ...m, checks: gate.checks.get(m.key) ?? null, overridden: overriddenText.has(m.text) }));
  const flagged = rechecked.some((r) => r.checks && isBlocking(r.checks) && !r.overridden) || gate.channel.some((c) => !c.ok);
  const recheckStatus = gate.status === 'gate_failed' ? 'gate_failed' : flagged ? 'flagged' : 'clean';

  const finalText = finalPosts.join('\n\n');
  const before = new Set(sentences.flatMap((s) => s.supports));
  const after = new Set(mapped.flatMap((m) => m.supports));
  const claimSetChanged = before.size !== after.size || [...before].some((c) => !after.has(c));
  const recheck = { sentences: rechecked, channel: gate.channel, error: gate.error };
  const row: Decision = {
    ...base,
    decision,
    reject_reason: null,
    reject_note: null,
    final_posts: finalPosts,
    final_text: finalText,
    text_hash: sha256(finalText),
    edit_ratio: editRatio(draft.generated_text, finalText),
    claim_set_changed: claimSetChanged,
    recheck,
    recheck_status: recheckStatus,
    assist: input.assist ?? null,
  };
  record(ctx, run, row);
  return {
    decision_id: row.id,
    decision,
    edit_ratio: row.edit_ratio,
    claim_set_changed: claimSetChanged,
    recheck_status: recheckStatus,
    text_hash: row.text_hash,
    recheck,
    condition: run.condition,
  };
}

/** The only path to posting: the creator types POST against the exact text that passed the re-check. Nothing calls X. */
export function publishConfirm(ctx: AppContext, draftId: string, input: { text_hash: string; typed_confirmation: string }) {
  const { decisions } = load(ctx, draftId);
  const accepted = latestAccept(decisions);
  if (!accepted?.final_posts || !accepted.text_hash) throw conflict('Accept the draft before publishing.');
  if (input.typed_confirmation !== PUBLISH_WORD) throw unprocessable(`Type ${PUBLISH_WORD} to confirm.`);
  if (input.text_hash !== accepted.text_hash) throw conflict('The text changed since it was checked. Review the latest version.', undefined, ErrorCode.TEXT_CHANGED);
  if (accepted.recheck_status !== 'clean') {
    const message = accepted.recheck_status === 'gate_failed' ? 'Checks could not run on the final text.' : 'The final text has unresolved flags.';
    throw conflict(message, { recheck: accepted.recheck }, ErrorCode.UNRESOLVED_FLAGS);
  }
  ctx.repos.drafts.confirm(draftId, accepted.text_hash, nowIso());
  return { copy_text: accepted.final_posts, compose_url: composeUrl(accepted.final_posts[0]), text_hash: accepted.text_hash };
}

export function markPosted(ctx: AppContext, draftId: string, input: { url?: string }) {
  const { draft, decisions } = load(ctx, draftId);
  const accepted = latestAccept(decisions);
  if (!accepted || draft.confirmed_hash !== accepted.text_hash) throw conflict('Confirm the final text before marking it as posted.');
  ctx.repos.drafts.markPosted(draftId, nowIso(), input.url || null);
  return { status: 'posted' as const };
}

export function addNote(ctx: AppContext, draftId: string, input: { note?: string | null }) {
  load(ctx, draftId);
  const note = input.note?.trim() || null;
  ctx.repos.drafts.setNote(draftId, note);
  return { note };
}
