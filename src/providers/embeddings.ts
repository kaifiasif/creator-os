import { contentWords } from '../domain/text.ts';
import { providerError, withRetry, type RetryPolicy } from './retry.ts';

/**
 * One interface for embeddings. Thresholds are calibrated per provider, because a lexical hash
 * embedder and a neural one put "the same angle" at very different similarities.
 */
export interface EmbeddingProvider {
  readonly name: string;
  readonly defaultThreshold: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

const DIMS = 512;

function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Signed feature hashing over content words and bigrams, L2-normalised. Deterministic and offline. */
export function localEmbed(text: string): Float32Array {
  const v = new Float32Array(DIMS);
  const words = contentWords(text);
  const features = new Map<string, number>();
  const add = (feature: string, weight: number) => features.set(feature, (features.get(feature) ?? 0) + weight);
  words.forEach((w, i) => {
    add(w, 1);
    if (i > 0) add(`${words[i - 1]}_${w}`, 0.6);
  });
  for (const [feature, tf] of features) {
    const h = fnv1a(feature);
    v[h % DIMS] += (h & 0x80000000 ? -1 : 1) * (1 + Math.log(tf));
  }
  const norm = Math.hypot(...v) || 1;
  for (let i = 0; i < DIMS; i++) v[i] /= norm;
  return v;
}

export const localEmbeddings: EmbeddingProvider = {
  name: 'local-hash-512',
  defaultThreshold: 0.6,
  embed: async (texts) => texts.map(localEmbed),
};

export function createOpenAiEmbeddings(apiKey: string, retry: RetryPolicy): EmbeddingProvider {
  return {
    name: 'openai:text-embedding-3-small',
    defaultThreshold: 0.82,
    async embed(texts) {
      if (!texts.length) return [];
      return withRetry(async () => {
        const res = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: texts }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!res.ok) throw await providerError('OpenAI embeddings', res);
        const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
        return json.data.sort((a, b) => a.index - b.index).map((d) => Float32Array.from(d.embedding));
      }, retry);
    },
  };
}
