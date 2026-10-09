/** Shapes derived from the server's RunView, so components can name what they take. */
import type { DraftSentence, RunView } from '@/api/types';

export type Decision = RunView['decisions'][number];
export type RunClaim = RunView['claims'][number];
export type RunSource = NonNullable<RunView['source']>;
export type StoredChecks = NonNullable<DraftSentence['checks']>;
export type Checks = Extract<StoredChecks, { traceability: unknown }>;
export type RepetitionMatch = Checks['repetition']['matches'][number];
export type VoiceFeature = NonNullable<Checks['voice']>['features'][number];
export type Recheck = NonNullable<Decision['recheck']>;
export type RecheckSentence = Recheck['sentences'][number];
export type ChannelIssue = Recheck['channel'][number];

export type AgentName = keyof RunView['agents'];
export type AgentEntry = NonNullable<RunView['agents'][AgentName]>;
export type AgentRun = Extract<AgentEntry, { output: unknown }>;
export type TraceStep = AgentRun['trace'][number];

export interface UnresolvedSentence {
  sentence_id: string;
  text: string;
}
