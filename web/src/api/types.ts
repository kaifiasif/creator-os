/** Response shapes, inferred from the server routes. Import these instead of redeclaring them. */
import type { InferRequestType, InferResponseType } from 'hono/client';
import type { api } from './client';

type Api = typeof api;
type Ok<T> = InferResponseType<T, 200>;

export type AppConfig = Ok<Api['config']['$get']>;
export type AuthSession = Ok<Api['auth']['session']['$get']>;
export type PublicUser = NonNullable<AuthSession['user']>;
export type MfaSetup = Ok<Api['auth']['mfa']['setup']['$post']>;
export type AgentSettings = Ok<Api['settings']['$get']>;

export type SourceList = Ok<Api['sources']['$get']>;
export type SourceSummary = SourceList[number];
export type SourceDetail = Ok<Api['sources'][':id']['$get']>;
export type Claim = SourceDetail['claims'][number];
export type Segment = SourceDetail['segments'][number];
export type Angle = Ok<Api['sources'][':id']['angles']['$get']>['angles'][number];

export type RunList = Ok<Api['runs']['$get']>;
export type RunSummary = RunList[number];
export type RunView = Ok<Api['runs'][':id']['$get']>;
export type DraftView = NonNullable<RunView['draft']>;
export type DraftPost = DraftView['posts'][number];
export type DraftSentence = DraftPost['sentences'][number];
export type CreateRunInput = InferRequestType<Api['runs']['$post']>['json'];

export type DecisionInput = InferRequestType<Api['drafts'][':id']['decision']['$post']>['json'];
export type DecisionResult = Ok<Api['drafts'][':id']['decision']['$post']>;
export type PublishResult = Ok<Api['drafts'][':id']['publish-confirm']['$post']>;

export type ArchiveList = Ok<Api['archive']['$get']>;
export type ArchiveImportInput = InferRequestType<Api['archive']['import']['$post']>['json'];
export type ArchivePreview = Ok<Api['archive']['preview']['$post']>;
export type ArchiveImportResult = Ok<Api['archive']['import']['$post']>;

export type Acceptance = Ok<Api['metrics']['acceptance']['$get']>;
export type AcceptanceOpen = Extract<Acceptance, { locked: false }>;
export type Drift = Ok<Api['metrics']['drift']['$get']>;
export type Calibration = Ok<Api['calibration']['pairs']['$get']>;

export type { Override, SentenceChecks, ChannelResult, VoiceScore, RejectReason, SourceKind, SourceStatus, RunStatus, Condition, DraftFormat, DecisionKind, AgentName, GateStatus, TraceabilityCheck } from '@server/domain/types.ts';
export type { ReviewOutput, ScoreOutput, DecisionPrediction, Verification } from '@server/modules/agents/agent.types.ts';
export type RehearsalConfig = Ok<Api['rehearsal']['config']['$get']>;
export type RehearsalState = Ok<Api['runs'][':id']['rehearsal']['$get']>;
export type Rehearsal = NonNullable<RehearsalState['rehearsal']>;
export type RehearsalResult = NonNullable<Rehearsal['result']>;
export type RehearsalStartInput = InferRequestType<Api['runs'][':id']['rehearsal']['$post']>['json'];
export type RehearsalInterviewResult = Ok<Api['rehearsals'][':id']['interview']['$post']>;
