/** Rules for what a creator may upload. Pure: no I/O, so every rule is unit-testable. */
import { extname } from 'node:path';
import { AppError, ErrorCode } from '../../core/errors.ts';
import type { SourceKind } from '../../domain/types.ts';

export const AUDIO_EXTENSIONS = ['.m4a', '.mp3', '.wav', '.mp4', '.webm', '.ogg'] as const;
export const TEXT_EXTENSIONS = ['.txt', '.md'] as const;
export const LIMITS = { audio: 200 * 1024 * 1024, text: 100 * 1024 } as const;

export interface UploadedFile {
  filename: string;
  contentType: string;
  data: Uint8Array;
}

export type Intake =
  | { medium: 'audio'; data: Uint8Array; extension: string; mime: string }
  | { medium: 'text'; text: string; mime: string };

/** Signatures at the start of each audio container, so a renamed file is caught before it is stored. */
const ascii = (data: Uint8Array, from: number, to: number) => String.fromCharCode(...data.subarray(from, to));
const AUDIO_SIGNATURES: Record<(typeof AUDIO_EXTENSIONS)[number], (d: Uint8Array) => boolean> = {
  '.mp3': (d) => ascii(d, 0, 3) === 'ID3' || (d[0] === 0xff && (d[1] & 0xe0) === 0xe0),
  '.wav': (d) => ascii(d, 0, 4) === 'RIFF' && ascii(d, 8, 12) === 'WAVE',
  '.m4a': (d) => ascii(d, 4, 8) === 'ftyp',
  '.mp4': (d) => ascii(d, 4, 8) === 'ftyp',
  '.webm': (d) => d[0] === 0x1a && d[1] === 0x45 && d[2] === 0xdf && d[3] === 0xa3,
  '.ogg': (d) => ascii(d, 0, 4) === 'OggS',
};

/** Text must be real UTF-8 with no NUL bytes; anything else is a binary file with a text name. */
function decodeText(data: Uint8Array): string | null {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(data);
    return text.includes('\0') ? null : text;
  } catch {
    return null;
  }
}

const notWhatItSays = (extension: string) =>
  new AppError(400, ErrorCode.UNSUPPORTED_FILE, `This file is named ${extension} but its contents are not. Export it again and retry.`, { extension });

const tooLarge = (message: string) => new AppError(413, ErrorCode.PAYLOAD_TOO_LARGE, message);

/** Decides whether the upload is audio or text and enforces the size limit for that medium. */
export function classifyIntake(input: { file?: UploadedFile; text?: string }): Intake {
  const { file, text } = input;
  if (file) {
    const extension = extname(file.filename).toLowerCase();
    if ((AUDIO_EXTENSIONS as readonly string[]).includes(extension)) {
      if (file.data.byteLength > LIMITS.audio) throw tooLarge('Audio files can be up to 200 MB.');
      if (!AUDIO_SIGNATURES[extension as keyof typeof AUDIO_SIGNATURES](file.data)) throw notWhatItSays(extension);
      return { medium: 'audio', data: file.data, extension, mime: file.contentType || 'application/octet-stream' };
    }
    if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) {
      if (file.data.byteLength > LIMITS.text) throw tooLarge('Text files can be up to 100 KB.');
      const decoded = decodeText(file.data);
      if (decoded === null) throw notWhatItSays(extension);
      return { medium: 'text', text: decoded, mime: 'text/plain' };
    }
    throw new AppError(400, ErrorCode.UNSUPPORTED_FILE, `Unsupported file type "${extension || 'unknown'}". Use ${[...AUDIO_EXTENSIONS, ...TEXT_EXTENSIONS].join(', ')}.`, {
      extension: extension || null,
    });
  }
  if (text?.trim()) {
    if (Buffer.byteLength(text) > LIMITS.text) throw tooLarge('Text can be up to 100 KB.');
    return { medium: 'text', text, mime: 'text/plain' };
  }
  throw new AppError(400, ErrorCode.VALIDATION_FAILED, 'Add a file or paste some text.');
}

export const defaultKind = (intake: Intake, kind: SourceKind | undefined): SourceKind => kind ?? (intake.medium === 'audio' ? 'voice_memo' : 'note');

export function assertConsent(kind: SourceKind, consent: boolean): void {
  if (kind === 'call' && !consent) {
    throw new AppError(422, ErrorCode.CONSENT_REQUIRED, 'Confirm that everyone on the call agreed to be recorded and processed.');
  }
}

export const defaultTitle = (title: string | undefined, kind: SourceKind) => title?.trim() || `Untitled ${kind.replace('_', ' ')}`;
