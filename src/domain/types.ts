/**
 * Domain types shared by repositories and services. Rows come out of repositories already decoded:
 * booleans are booleans, JSON columns are objects, embeddings are Float32Array.
 */
import type { Vector } from '../db/codec.ts';

export type { Vector };
export type IsoDate = string;

// ---------------------------------------------------------------- enums
export const SOURCE_KINDS = ['voice_memo', 'call', 'note'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type SourceStatus = 'transcribing' | 'mapping' | 'extracting' | 'ready' | 'nothing_postable' | 'failed';
export type Condition = 'gate' | 'context_only';
export type DraftFormat = 'post' | 'thread';
export type AngleChoice = 'picked' | 'custom' | 'auto_angle';
export type RunStatus = 'generating' | 'gate_failed' | 'in_review' | 'decided' | 'failed';
export type GateStatus = 'clean' | 'flagged' | 'gate_failed';
export type SentenceType = 'assertion' | 'connective';
export type DecisionKind = 'accept' | 'edit_then_accept' | 'reject';

export const REJECT_REASONS = ['not_me', 'wrong_claim', 'repeat', 'not_worth_posting', 'other'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const AGENT_NAMES = ['reviewer', 'scorer', 'decision'] as const;
export type AgentName = (typeof AGENT_NAMES)[number];
export type AgentStatus = 'running' | 'done' | 'failed';

export type Outcome = 'light_accept' | 'substantive_rewrite' | 'rejected_fixed' | 'rejected_pending' | 'abandoned' | 'pending';

// ---------------------------------------------------------------- archive
export interface ArchivePiece {
  id: string;
  external_id: string;
  text: string;
  parts: string[] | null;
  published_at: IsoDate;
  url: string | null;
  embedding: Vector;
  embedding_provider: string;
  is_holdout: boolean;
  retired: boolean;
  retired_reason: string | null;
  created_at: IsoDate;
}

export interface ArchiveChunk {
  piece_id: string;
  embedding: Vector;
  text: string;
  published_at: IsoDate;
  url: string | null;
  retired: boolean;
}

export interface RetiredAngle {
  id: string;
  piece_id: string | null;
  claim_id: string | null;
  text: string;
  reason: string;
  embedding: Vector;
  created_at: IsoDate;
}

// ---------------------------------------------------------------- sources
export interface ExtractionLog {
  extracted: number;
  kept: number;
  creator_claims: number;
  dropped: { quote: string; reason: string }[];
}

export interface SourceItem {
  id: string;
  title: string;
  kind: SourceKind;
  content_hash: string;
  storage_path: string | null;
  mime: string;
  status: SourceStatus;
  transcript_text: string | null;
  speakers: string[] | null;
  creator_speaker: string | null;
  consent_confirmed: boolean;
  extraction_log: ExtractionLog | null;
  error: string | null;
  created_at: IsoDate;
}

export interface Segment {
  id: string;
  source_item_id: string;
  position: number;
  speaker: string;
  start_ms: number | null;
  end_ms: number | null;
  char_start: number;
  char_end: number;
  text: string;
}

export interface Claim {
  id: string;
  source_item_id: string;
  text: string;
  speaker: string;
  is_creator: boolean;
  char_start: number;
  char_end: number;
  quote: string;
  embedding: Vector;
  retired: boolean;
  retired_reason: string | null;
}

export interface Angle {
  id: string;
  source_item_id: string;
  position: number;
  lead_claim_id: string;
  claim_ids: string[];
  rationale: string;
  closest_piece_id: string | null;
  closest_similarity: number | null;
  retired_match: boolean;
}

// ---------------------------------------------------------------- checks
export interface TraceabilityCheck {
  status: 'supported' | 'partial' | 'unsupported';
  reason: string;
  type: SentenceType;
}

export interface RepetitionMatch {
  piece_id: string;
  similarity: number;
  text: string;
  published_at: IsoDate;
  url: string | null;
  retired: boolean;
}

export interface RepetitionCheck {
  flag: boolean;
  severity: 'normal' | 'high' | null;
  threshold?: number;
  matches: RepetitionMatch[];
  retired_match: { similarity: number; reason: string; text: string } | null;
}

export type VoiceFeatureFlag = { feature: string; z: number } | { feature: string; archive_rate: number };

export interface VoiceCheck {
  flag: boolean;
  features: VoiceFeatureFlag[];
  skipped?: boolean;
}

export interface SentenceChecks {
  traceability: TraceabilityCheck;
  repetition: RepetitionCheck;
  voice?: VoiceCheck;
}

/** Stored when a sentence could not be checked at all. */
export type StoredChecks = SentenceChecks | { error: string };

export interface ChannelResult {
  position: number;
  length: number;
  ok: boolean;
  issues: string[];
}

export type VoiceScore =
  | { skipped: true; notice: string }
  | {
      skipped: false;
      z_scores: Record<string, number>;
      opening_pattern: string;
      opening_pattern_archive_share: number;
      centroid_distance: number;
      archive_distance_p90: number;
      beyond_p90: boolean;
      holdout_false_flag_rate: number | null;
    };

// ---------------------------------------------------------------- runs, drafts, decisions
export interface ModelVersions {
  llm: string;
  main: string;
  judge: string;
  embeddings: string;
  prompts: Record<string, string>;
  agents: Record<string, string> | null;
}

export interface Run {
  id: string;
  source_item_id: string;
  condition: Condition;
  seed: number;
  memory_enabled: boolean;
  format: DraftFormat;
  angle_choice: AngleChoice;
  angle_claim_ids: string[];
  custom_angle: string | null;
  status: RunStatus;
  model_versions: ModelVersions;
  prompt_archive_ids: string[] | null;
  error: string | null;
  created_at: IsoDate;
  ready_at: IsoDate | null;
}

export interface Draft {
  id: string;
  run_id: string;
  generated_text: string;
  gate_status: GateStatus;
  gate_error: string | null;
  voice_score: (VoiceScore & { channel?: ChannelResult[] }) | { channel: ChannelResult[] } | null;
  confirmed_hash: string | null;
  confirmed_at: IsoDate | null;
  posted_at: IsoDate | null;
  posted_url: string | null;
  note: string | null;
  created_at: IsoDate;
}

export interface DraftSentence {
  id: string;
  draft_id: string;
  post_position: number;
  position: number;
  text: string;
  type: SentenceType;
  supports: string[];
  checks: StoredChecks;
}

export interface Override {
  sentence_id?: string;
  sentence_text?: string;
  reason: string;
}

export interface RecheckedSentence {
  key: string;
  post_position: number;
  position: number;
  text: string;
  type: SentenceType;
  supports: string[];
  from_sentence_id: string | null;
  unchanged: boolean;
  checks: SentenceChecks | null;
  overridden: boolean;
}

export interface Recheck {
  sentences: RecheckedSentence[];
  channel: ChannelResult[];
  error: string | null;
}

export interface Decision {
  id: string;
  draft_id: string;
  decision: DecisionKind;
  reject_reason: RejectReason | null;
  reject_note: string | null;
  final_posts: string[] | null;
  final_text: string | null;
  text_hash: string | null;
  edit_ratio: number | null;
  claim_set_changed: boolean | null;
  overrides: Override[];
  recheck: Recheck | null;
  recheck_status: GateStatus | null;
  assist: 'reviewer' | null;
  time_to_decision_ms: number | null;
  decided_at: IsoDate;
}

// ---------------------------------------------------------------- agents
export interface TraceStep {
  step: number;
  kind: 'thought' | 'tool' | 'submit' | 'submit_rejected';
  tool?: string;
  text?: string;
  input?: unknown;
  result?: unknown;
  error?: string | boolean;
}

export interface AgentRun {
  id: string;
  run_id: string;
  agent: AgentName;
  status: AgentStatus;
  output: unknown;
  trace: TraceStep[];
  model: string;
  version: string;
  error: string | null;
  ms: number | null;
  started_at: IsoDate;
  finished_at: IsoDate | null;
}

export interface AgentSettings {
  agents_enabled: boolean;
  show_recommendation: boolean;
}
