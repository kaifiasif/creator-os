// Types for the parts of this module Creator OS 0.5 (TypeScript) calls. The web app infers its
// response types from the server routes, so these shapes reach the UI as-is.
export interface RehearsalDb {
  get(sql: string, ...params: unknown[]): unknown;
  all(sql: string, ...params: unknown[]): unknown[];
  run(sql: string, ...params: unknown[]): unknown;
  exec?(sql: string): void;
}

export type RehearsalEngine = 'swarm' | 'swarm-offline' | 'mirofish';
export type RehearsalStatus = 'queued' | 'ontology' | 'graph' | 'preparing' | 'running' | 'reporting' | 'done' | 'failed';
export type Stance = 'supportive' | 'skeptical' | 'neutral';

export interface RehearsalConfigView {
  enabled: boolean;
  engine: RehearsalEngine | undefined;
  max_rounds: number;
  before_decision: boolean;
  interviews: boolean;
}

export interface RehearsalPersona { id: number; name: string; segment: string; stance: Stance; bio: string }
export interface RehearsalReply { agent_id: number; agent_name: string; round: number | null; kind?: 'reply' | 'quote'; text: string; stance: 'pushback' | 'other' }
export interface SentenceReaction { id: string | null; text: string; mentions: number; pushback: number; examples: string[] }

export interface RehearsalResult {
  engine: RehearsalEngine;
  model?: string | null;
  model_calls?: number;
  personas?: RehearsalPersona[];
  draft_seeded: boolean;
  draft_match: number;
  agents: number;
  rounds: number | null;
  total_actions: number;
  counts: { likes: number; reposts: number; quotes: number; replies: number; dislikes: number };
  replies: RehearsalReply[];
  related: { agent_id: number; text: string; stance: 'pushback' | 'other' }[];
  sentences: SentenceReaction[];
  pushback_share: number;
  report: { id: string | null; markdown: string } | null;
  report_error?: string;
}

export interface Interview { agent_id: number; prompt: string; answer: string; at: string }

export interface Rehearsal {
  id: string;
  run_id: string;
  status: RehearsalStatus;
  progress: number;
  settings: { max_rounds: number; audience: string | null; handle: string };
  simulation_id: string | null;
  result: RehearsalResult | null;
  interviews: Interview[];
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface RehearsalState { enabled: boolean; engine: RehearsalEngine | undefined; before_decision: boolean; rehearsal: Rehearsal | null }
export interface StartBody { audience?: string; max_rounds?: number; force?: boolean }
export interface InterviewBody { agent_id: number; prompt: string }

export interface RehearsalService {
  config(): RehearsalConfigView;
  get(runId: string): RehearsalState;
  start(runId: string, body?: StartBody): Rehearsal;
  interview(rehearsalId: string, body: InterviewBody): Promise<Interview>;
}

export class RehearsalError extends Error {
  readonly status: number;
}

export function rehearsalService(deps: { db: RehearsalDb; background: (job: () => Promise<unknown> | unknown) => void; client?: unknown; engine?: unknown; config?: unknown }): RehearsalService;
export function ensureSchema(db: RehearsalDb): void;
