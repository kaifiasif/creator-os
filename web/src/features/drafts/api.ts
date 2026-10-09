import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { pollWhile, queryKeys } from '@/api/query-client';
import type { CreateRunInput, RunList } from '@/api/types';

export function useRuns() {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: () => unwrap(api.runs.$get()),
    refetchInterval: pollWhile<RunList>((runs) => runs.some((r) => r.status === 'generating')),
  });
}

/** Starts drafting from a source. The caller navigates to the new run. */
export function useCreateRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRunInput) => unwrap(api.runs.$post({ json: input })),
    onSuccess: (_, input) => {
      void client.invalidateQueries({ queryKey: queryKeys.runs });
      void client.invalidateQueries({ queryKey: queryKeys.source(input.source_item_id) });
    },
  });
}
