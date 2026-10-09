import type { SourceKind } from '@/api/types';
import { fileProblem, mediumOf, needsConsent, titleFromName, type Medium } from './intake-rules';
import { sniffTranscript, type Sniff } from './sniff';

export type UploadPhase = 'waiting' | 'uploading' | 'added' | 'failed';

export interface QueueItem {
  key: string;
  file: File;
  medium: Medium | null;
  title: string;
  kind: SourceKind;
  consent: boolean;
  /** A client-side reason the file cannot be sent at all. */
  problem: string | null;
  sniff: Sniff | null;
  phase: UploadPhase;
  progress: number;
  error: unknown;
  sourceId: string | null;
}

let sequence = 0;

export async function toQueueItem(file: File, title?: string): Promise<QueueItem> {
  const medium = mediumOf(file);
  const problem = fileProblem(file);
  const sniff = medium === 'text' && !problem ? sniffTranscript(await file.text()) : null;
  const kind: SourceKind = medium === 'audio' ? 'voice_memo' : sniff?.speakers.length ? 'call' : 'note';
  return {
    key: `upload-${++sequence}`,
    file,
    medium,
    title: title ?? titleFromName(file.name),
    kind,
    consent: false,
    problem,
    sniff,
    phase: 'waiting',
    progress: 0,
    error: null,
    sourceId: null,
  };
}

export const isEditable = (item: QueueItem) => item.phase === 'waiting' || item.phase === 'failed';

/** Ready to send: no file problem, not already sent, and consent given when the kind needs it. */
export const canUpload = (item: QueueItem) => isEditable(item) && !item.problem && (!needsConsent(item.kind) || item.consent);
