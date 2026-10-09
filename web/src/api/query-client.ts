import { QueryClient } from '@tanstack/react-query';
import { isApiError } from './errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      refetchOnWindowFocus: true,
      // a 4xx will not fix itself on retry; a network blip might
      retry: (count, error) => count < 2 && !(isApiError(error) && error.status >= 400 && error.status < 500),
    },
  },
});

/** Every cache key in one place, so invalidation after a mutation is never a guess. */
export const queryKeys = {
  session: ['session'] as const,
  config: ['config'] as const,
  settings: ['settings'] as const,
  sources: ['sources'] as const,
  source: (id: string) => ['sources', id] as const,
  angles: (id: string) => ['sources', id, 'angles'] as const,
  runs: ['runs'] as const,
  run: (id: string) => ['runs', id] as const,
  archive: ['archive'] as const,
  calibration: ['calibration'] as const,
  acceptance: ['metrics', 'acceptance'] as const,
  drift: ['metrics', 'drift'] as const,
  rehearsalConfig: ['rehearsal', 'config'] as const,
  rehearsal: (runId: string) => ['runs', runId, 'rehearsal'] as const,
};

/** Polls every `ms` while `isBusy(data)` says background work is still running. */
export const pollWhile =
  <T,>(isBusy: (data: T) => boolean, ms = 1200) =>
  (query: { state: { data: T | undefined } }) =>
    query.state.data !== undefined && isBusy(query.state.data) ? ms : false;
