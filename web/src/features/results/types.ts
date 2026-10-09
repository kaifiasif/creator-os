import type { AcceptanceOpen, Drift } from '@/api/types';

export type RateStat = AcceptanceOpen['by_condition']['gate'];
export type RunRow = AcceptanceOpen['table'][number];
export type AgentStats = AcceptanceOpen['agents'];
export type DriftReady = Extract<Drift, { ready: true }>;
export type DriftPoint = DriftReady['history'][number];
export type DriftPair = DriftReady['pairs'][number];
