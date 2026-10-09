/** Encoding helpers for the column conventions in 0001_initial.sql. Used by repositories only. */

export type Vector = Float32Array;

export const json = {
  encode: (value: unknown): string | null => (value === null || value === undefined ? null : JSON.stringify(value)),
  decode: <T>(text: unknown): T => JSON.parse(String(text)) as T,
  decodeNullable: <T>(text: unknown): T | null => (text === null || text === undefined ? null : (JSON.parse(String(text)) as T)),
};

export const bool = {
  decode: (value: unknown): boolean => value === 1 || value === 1n || value === true,
  decodeNullable: (value: unknown): boolean | null => (value === null || value === undefined ? null : value === 1 || value === 1n),
};

/** Embeddings are stored as float32 BLOBs: half the size of JSON and no parsing on read. */
export const vector = {
  encode: (v: ArrayLike<number>): Uint8Array => new Uint8Array(Float32Array.from(v).buffer),
  decode: (blob: unknown): Vector => {
    const bytes = blob as Uint8Array;
    return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  },
};
