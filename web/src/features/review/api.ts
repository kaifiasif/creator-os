import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { pollWhile, queryKeys } from '@/api/query-client';
import type { DecisionInput, RunView } from '@/api/types';

/** Keep polling while the draft is being written or any agent is still working on it. */
const stillWorking = (run: RunView) => run.status === 'generating' || Object.values(run.agents).some((a) => a?.status === 'running');

export function useRun(id: string) {
  return useQuery({
    queryKey: queryKeys.run(id),
    queryFn: () => unwrap(api.runs[':id'].$get({ param: { id } })),
    refetchInterval: pollWhile<RunView>(stillWorking),
  });
}

function useInvalidateRun(runId: string) {
  const client = useQueryClient();
  return () => {
    void client.invalidateQueries({ queryKey: queryKeys.run(runId) });
    void client.invalidateQueries({ queryKey: queryKeys.runs });
    void client.invalidateQueries({ queryKey: ['metrics'] });
  };
}

export function useReviewActions(runId: string, draftId: string | undefined) {
  const invalidate = useInvalidateRun(runId);
  const draft = () => {
    if (!draftId) throw new Error('This run has no draft yet.');
    return { id: draftId };
  };
  return {
    decide: useMutation({
      mutationFn: (input: DecisionInput) => unwrap(api.drafts[':id'].decision.$post({ param: draft(), json: input })),
      onSuccess: invalidate,
    }),
    confirmPublish: useMutation({
      mutationFn: (text_hash: string) => unwrap(api.drafts[':id']['publish-confirm'].$post({ param: draft(), json: { text_hash, typed_confirmation: 'POST' } })),
      onSuccess: invalidate,
    }),
    markPosted: useMutation({
      mutationFn: (url: string) => unwrap(api.drafts[':id'].posted.$post({ param: draft(), json: { url } })),
      onSuccess: invalidate,
    }),
    saveNote: useMutation({
      mutationFn: (note: string) => unwrap(api.drafts[':id'].note.$post({ param: draft(), json: { note } })),
      onSuccess: invalidate,
    }),
    retryRun: useMutation({
      mutationFn: () => unwrap(api.runs[':id'].retry.$post({ param: { id: runId } })),
      onSuccess: invalidate,
    }),
    retryAgents: useMutation({
      mutationFn: () => unwrap(api.runs[':id'].agents.$post({ param: { id: runId } })),
      onSuccess: invalidate,
    }),
  };
}
