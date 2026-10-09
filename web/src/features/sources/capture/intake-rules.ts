/** Client-side mirror of src/modules/sources/intake.ts, so a bad file is caught before it is sent. */
import type { SourceKind } from '@/api/types';
import { formatBytes } from '@/lib/format';

export const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.mp4', '.webm', '.ogg'] as const;
export const TEXT_EXTENSIONS = ['.txt', '.md'] as const;
export const LIMITS = { audio: 200 * 1024 * 1024, text: 100 * 1024 } as const;
export const ACCEPT = [...AUDIO_EXTENSIONS, ...TEXT_EXTENSIONS, 'audio/*'].join(',');

export type Medium = 'audio' | 'text';

export const extensionOf = (name: string) => (name.match(/\.[^.]+$/)?.[0] ?? '').toLowerCase();

export function mediumOf(file: File): Medium | null {
  const extension = extensionOf(file.name);
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(extension)) return 'audio';
  if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) return 'text';
  return null;
}

/** The reason a file cannot be uploaded, in the server's own words, or null when it is fine. */
export function fileProblem(file: File): string | null {
  const medium = mediumOf(file);
  if (!medium) {
    const extension = extensionOf(file.name) || 'this type';
    return `${extension} files cannot be added. Use audio (${AUDIO_EXTENSIONS.join(' ')}) or text (${TEXT_EXTENSIONS.join(' ')}).`;
  }
  if (file.size > LIMITS[medium]) {
    return medium === 'audio'
      ? `This file is ${formatBytes(file.size)}. Audio files can be up to 200 MB.`
      : `This file is ${formatBytes(file.size)}. Text files can be up to 100 KB.`;
  }
  return null;
}

export const textTooLarge = (text: string) => new TextEncoder().encode(text).byteLength > LIMITS.text;

/** "walk-memo_review.m4a" becomes "Walk memo review". */
export const titleFromName = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());

/** Calls involve other people, so the server requires their consent. */
export const needsConsent = (kind: SourceKind) => kind === 'call';
