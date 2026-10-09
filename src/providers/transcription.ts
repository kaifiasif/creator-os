import { readFile } from 'node:fs/promises';
import { providerError, withRetry, type RetryPolicy } from './retry.ts';

export interface TranscriptSegment {
  position: number;
  speaker: string;
  start_ms: number | null;
  end_ms: number | null;
  char_start: number;
  char_end: number;
  text: string;
}

export interface Transcript {
  transcript_text: string;
  segments: TranscriptSegment[];
  speakers: string[];
}

export interface TranscriptionProvider {
  readonly name: string;
  readonly canTranscribeAudio: boolean;
  transcribeAudio(path: string): Promise<Transcript>;
}

const SPEAKER_LINE = /^\s*(?:\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*)?([A-Za-z][\w .'-]{0,30}?)\s*(?:\[(\d{1,2}:\d{2}(?::\d{2})?)\])?\s*:\s+(.+)$/;

const toMs = (timestamp: string | undefined): number | null => {
  if (!timestamp) return null;
  const p = timestamp.split(':').map(Number);
  return (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]) * 1000;
};

type RawSegment = { speaker: string; text: string; start_ms?: number | null; end_ms?: number | null };

/** Joins segments into one transcript whose char offsets index into it exactly. */
function assemble(raw: RawSegment[]): Transcript {
  let text = '';
  const segments = raw.map((s, position) => {
    if (text) text += '\n\n';
    const char_start = text.length;
    text += s.text;
    return { position, speaker: s.speaker, start_ms: s.start_ms ?? null, end_ms: s.end_ms ?? null, char_start, char_end: text.length, text: s.text };
  });
  return { transcript_text: text, segments, speakers: [...new Set(segments.map((s) => s.speaker))] };
}

/** "Name: words" lines become speaker segments; anything else becomes paragraphs by "Me". */
export function parseTextTranscript(raw: string): Transcript {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const nonEmpty = lines.filter((l) => l.trim());
  const speakerLines = nonEmpty.filter((l) => SPEAKER_LINE.test(l));
  const looksDiarized = speakerLines.length >= 2 && speakerLines.length / nonEmpty.length >= 0.4;

  if (!looksDiarized) {
    const paragraphs = raw
      .replace(/\r\n/g, '\n')
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
      .filter(Boolean);
    return assemble(paragraphs.map((text) => ({ speaker: 'Me', text })));
  }

  const segments: RawSegment[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(SPEAKER_LINE);
    const last = segments.at(-1);
    if (m) segments.push({ speaker: m[2].trim(), start_ms: toMs(m[1] ?? m[3]), text: m[4].trim() });
    else if (last) last.text += ` ${line.trim()}`;
    else segments.push({ speaker: 'Me', text: line.trim() });
  }
  segments.forEach((s, i) => {
    const next = segments[i + 1];
    if (next && s.start_ms != null && next.start_ms != null) s.end_ms = next.start_ms;
  });
  return assemble(segments);
}

export const noAudioTranscription: TranscriptionProvider = {
  name: 'none',
  canTranscribeAudio: false,
  transcribeAudio: async () => {
    throw new Error('No audio transcription provider is configured (set ASSEMBLYAI_API_KEY). Paste the transcript instead.');
  },
};

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 360; // 15 minutes

export function createAssemblyAi(apiKey: string, retry: RetryPolicy): TranscriptionProvider {
  const headers = { authorization: apiKey };
  const call = <T>(url: string, init: RequestInit = {}) =>
    withRetry(async () => {
      const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw await providerError('AssemblyAI', res);
      return (await res.json()) as T;
    }, retry);

  return {
    name: 'assemblyai:universal',
    canTranscribeAudio: true,
    async transcribeAudio(path) {
      const { upload_url } = await call<{ upload_url: string }>('https://api.assemblyai.com/v2/upload', { method: 'POST', body: await readFile(path) });
      const job = await call<{ id: string }>('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ audio_url: upload_url, speaker_labels: true }),
      });
      type Status = { status: string; error?: string; text: string; audio_duration: number; utterances?: { speaker: string; start: number; end: number; text: string }[] };
      for (let i = 0; i < MAX_POLLS; i++) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        const t = await call<Status>(`https://api.assemblyai.com/v2/transcript/${job.id}`);
        if (t.status === 'error') throw new Error(`Transcription failed: ${t.error}`);
        if (t.status === 'completed') {
          const utterances = t.utterances?.length ? t.utterances : [{ speaker: 'A', start: 0, end: t.audio_duration * 1000, text: t.text }];
          return assemble(utterances.map((u) => ({ speaker: u.speaker, start_ms: u.start, end_ms: u.end, text: u.text })));
        }
      }
      throw new Error('Transcription timed out after 15 minutes.');
    },
  };
}
