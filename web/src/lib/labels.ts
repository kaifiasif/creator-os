/** Every user-facing name for a server enum, in one place. */
import type {
  AgentName,
  ArchiveImportInput,
  ArchivePreview,
  Condition,
  DecisionKind,
  DraftFormat,
  GateStatus,
  Rehearsal,
  RehearsalResult,
  RejectReason,
  RunStatus,
  SourceKind,
  SourceStatus,
  TraceabilityCheck,
} from '@/api/types';

export type Tone = 'neutral' | 'info' | 'supported' | 'partial' | 'unsupported' | 'repeat';

export interface StatusLabel {
  label: string;
  tone: Tone;
  busy?: boolean;
}

export const SOURCE_KIND: Record<SourceKind, string> = { voice_memo: 'Voice memo', call: 'Call', note: 'Note' };

export const SOURCE_STATUS: Record<SourceStatus, StatusLabel> = {
  transcribing: { label: 'Transcribing', tone: 'info', busy: true },
  mapping: { label: 'Pick your voice', tone: 'partial' },
  extracting: { label: 'Finding claims', tone: 'info', busy: true },
  ready: { label: 'Ready to draft', tone: 'supported' },
  nothing_postable: { label: 'Nothing postable', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'unsupported' },
};

export const RUN_STATUS: Record<RunStatus, StatusLabel> = {
  generating: { label: 'Drafting', tone: 'info', busy: true },
  in_review: { label: 'Needs review', tone: 'partial' },
  gate_failed: { label: 'Checks failed', tone: 'unsupported' },
  decided: { label: 'Decided', tone: 'supported' },
  failed: { label: 'Failed', tone: 'unsupported' },
};

export const REJECT_REASON: Record<RejectReason, string> = {
  not_me: "Doesn't sound like me",
  wrong_claim: 'Gets a claim wrong',
  repeat: "I've said this before",
  not_worth_posting: 'Not worth posting',
  other: 'Something else',
};

export const PROBLEM: Record<string, StatusLabel> = {
  unsupported: { label: 'Not backed', tone: 'unsupported' },
  partial: { label: 'Partly backed', tone: 'partial' },
  repeat: { label: 'Said before', tone: 'repeat' },
  voice: { label: 'Voice', tone: 'neutral' },
  clarity: { label: 'Clarity', tone: 'neutral' },
  channel: { label: 'X rules', tone: 'unsupported' },
};

export const SCORE_DIMENSION: Record<string, string> = {
  traceability: 'Backed by source',
  novelty: 'New to your archive',
  voice_fit: 'Sounds like you',
  hook: 'Opening',
  clarity: 'Clarity',
};

export const RECOMMENDATION: Record<string, string> = { accept: 'Accept as is', edit: 'Edit, then accept', reject: 'Reject' };

export const OUTCOME: Record<string, string> = {
  light_accept: 'Light edit',
  substantive_rewrite: 'Rewritten',
  rejected_fixed: 'Rejected, then fixed',
  rejected_pending: 'Rejected',
  abandoned: 'Abandoned',
  pending: 'Pending',
};

export const DRAFT_FORMAT: Record<DraftFormat, string> = { post: 'Single post', thread: 'Thread' };

export const DECISION_KIND: Record<DecisionKind, string> = {
  accept: 'Accepted as is',
  edit_then_accept: 'Edited, then accepted',
  reject: 'Rejected',
};

export const CONDITION: Record<Condition, { label: string; description: string }> = {
  gate: { label: 'Checks shown', description: 'You saw the check results while you reviewed this draft.' },
  context_only: { label: 'Checks hidden', description: 'Checks ran silently and were shown only after you decided.' },
};

export const AGENT: Record<AgentName, string> = { reviewer: 'Reviewer', scorer: 'Scorer', decision: 'Decision' };

export const ISSUE_ACTION: Record<'replace' | 'remove' | 'keep', string> = { replace: 'Rewrite', remove: 'Remove', keep: 'Keep, but look' };

export const RECHECK_STATUS: Record<GateStatus, string> = {
  clean: 'Passed every check',
  flagged: 'Needs attention',
  gate_failed: 'Checks could not run',
};

export const TRACEABILITY: Record<TraceabilityCheck['status'], string> = {
  supported: 'Backed by the source',
  partial: 'Partly backed by the source',
  unsupported: 'Not backed by the source',
};

export const IMPORT_FORMAT: Record<NonNullable<ArchiveImportInput['format']>, { title: string; description: string }> = {
  x_export: { title: 'X archive export', description: 'The tweets.js file from the data folder of your X archive.' },
  csv: { title: 'CSV file', description: 'A "text" column, plus optional published_at, url and external_id.' },
  paste: { title: 'Paste posts', description: 'One post per paragraph, separated by a blank line.' },
};

export const PREVIEW_STATUS: Record<ArchivePreview['rows'][number]['status'], string> = { new: 'New', exists: 'Already imported' };

export const EXCLUDED_REASON: Record<ArchivePreview['excluded'][number]['reason'], string> = { retweet: 'Retweet', reply: 'Reply' };
export const REHEARSAL_STATUS: Record<Rehearsal['status'], StatusLabel> = {
  queued: { label: 'Waiting to start', tone: 'info', busy: true },
  ontology: { label: 'Reading your draft', tone: 'info', busy: true },
  graph: { label: 'Building the knowledge graph', tone: 'info', busy: true },
  preparing: { label: 'Creating followers', tone: 'info', busy: true },
  running: { label: 'Simulating the feed', tone: 'info', busy: true },
  reporting: { label: 'Writing the report', tone: 'info', busy: true },
  done: { label: 'Done', tone: 'supported' },
  failed: { label: 'Failed', tone: 'unsupported' },
};

export const REHEARSAL_ACTIVE: ReadonlySet<Rehearsal['status']> = new Set(['queued', 'ontology', 'graph', 'preparing', 'running', 'reporting']);

export const REHEARSAL_ENGINE: Record<RehearsalResult['engine'], StatusLabel> = {
  swarm: { label: 'Simulated followers', tone: 'supported' },
  'swarm-offline': { label: 'Offline estimate', tone: 'partial' },
  mirofish: { label: 'MiroFish', tone: 'supported' },
};

/** How a draft is laid out. */
export const FORMAT: Record<'post' | 'thread', string> = { post: 'Single post', thread: 'Thread' };
