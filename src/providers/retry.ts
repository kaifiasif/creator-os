/**
 * Retries for outbound provider calls only (PRD 13: twice, after 1s then 4s, with jitter).
 * This is the single retry layer: services and jobs never retry these calls again.
 */
export interface RetryPolicy {
  delaysMs: number[];
}

export const DEFAULT_RETRY: RetryPolicy = { delaysMs: [1000, 4000] };

/** A failure the caller caused (4xx other than 408/429) will not succeed on retry. */
export class PermanentProviderError extends Error {
  override name = 'PermanentProviderError';
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(work: (attempt: number) => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= policy.delaysMs.length; attempt++) {
    try {
      return await work(attempt);
    } catch (error) {
      lastError = error;
      if (error instanceof PermanentProviderError || attempt === policy.delaysMs.length) break;
      const base = policy.delaysMs[attempt];
      await sleep(base + Math.random() * base * 0.2);
    }
  }
  throw lastError;
}

/** Turns a non-2xx response into the right error type, keeping the body for the log. */
export async function providerError(provider: string, res: Response): Promise<Error> {
  const body = (await res.text()).slice(0, 300);
  const message = `${provider} ${res.status}: ${body}`;
  const retryable = res.status >= 500 || res.status === 408 || res.status === 429;
  return retryable ? new Error(message) : new PermanentProviderError(message);
}
