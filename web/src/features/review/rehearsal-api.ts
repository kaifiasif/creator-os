import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { pollWhile, queryKeys } from '@/api/query-client';
import type { RehearsalStartInput, RehearsalState } from '@/api/types';
import { REHEARSAL_ACTIVE } from '@/lib/labels';

export function useRehearsalConfig() {
  return useQuery({
    queryKey: queryKeys.rehearsalConfig,
    queryFn: () => unwrap(api.rehearsal.config.$get()),
    staleTime: Infinity,
  });
}

/** Keep polling while a rehearsal is in flight; the simulation runs in the background on the server. */
export function useRehearsal(runId: string) {
  return useQuery({
    queryKey: queryKeys.rehearsal(runId),
    queryFn: () => unwrap(api.runs[':id'].rehearsal.$get({ param: { id: runId } })),
    refetchInterval: pollWhile<RehearsalState>((d) => d.rehearsal !== null && REHEARSAL_ACTIVE.has(d.rehearsal.status), 2000),
  });
}

export function useRehearsalActions(runId: string) {
  const client = useQueryClient();
  const invalidate = () => void client.invalidateQueries({ queryKey: queryKeys.rehearsal(runId) });
  return {
    start: useMutation({
      mutationFn: (input: RehearsalStartInput) => unwrap(api.runs[':id'].rehearsal.$post({ param: { id: runId }, json: input })),
      onSuccess: invalidate,
    }),
    interview: useMutation({
      mutationFn: (input: { rehearsalId: string; agent_id: number; prompt: string }) =>
        unwrap(api.rehearsals[':id'].interview.$post({ param: { id: input.rehearsalId }, json: { agent_id: input.agent_id, prompt: input.prompt } })),
      onSuccess: invalidate,
    }),
  };
}
