import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { queryKeys } from '@/api/query-client';
import type { AgentSettings } from '@/api/types';

export function useConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: () => unwrap(api.config.$get()), staleTime: Number.POSITIVE_INFINITY });
}

export function useAgentSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: () => unwrap(api.settings.$get()) });
}

export function useSaveAgentSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<AgentSettings>) => unwrap(api.settings.$post({ json: patch })),
    onSuccess: (settings) => client.setQueryData(queryKeys.settings, settings),
  });
}
