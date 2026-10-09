import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, uploadWithProgress } from '@/api/client';
import { pollWhile, queryKeys } from '@/api/query-client';
import type { SourceDetail, SourceKind, SourceList } from '@/api/types';
import { SOURCE_STATUS } from '@/lib/labels';

const isBusy = (status: SourceDetail['status']) => Boolean(SOURCE_STATUS[status].busy);

export function useSources() {
  return useQuery({
    queryKey: queryKeys.sources,
    queryFn: () => unwrap(api.sources.$get()),
    refetchInterval: pollWhile<SourceList>((list) => list.some((s) => isBusy(s.status))),
  });
}

export function useSource(id: string) {
  return useQuery({
    queryKey: queryKeys.source(id),
    queryFn: () => unwrap(api.sources[':id'].$get({ param: { id } })),
    refetchInterval: pollWhile<SourceDetail>((s) => isBusy(s.status)),
  });
}

export function useAngles(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.angles(id),
    queryFn: () => unwrap(api.sources[':id'].angles.$get({ param: { id } })).then((r) => r.angles),
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** After any change to a source, both the list and its detail are stale. */
function useInvalidateSource() {
  const client = useQueryClient();
  return (id?: string) => {
    void client.invalidateQueries({ queryKey: queryKeys.sources });
    if (id) void client.invalidateQueries({ queryKey: queryKeys.source(id) });
  };
}

export interface NewSource {
  title?: string;
  kind?: SourceKind;
  consent_confirmed: boolean;
  text?: string;
  file?: File;
}

type Accepted = { source_item_id: string; status: string };

/** Creates a source from pasted text (JSON) or a file (multipart with progress). */
export function createSourceRequest(input: NewSource, onProgress: (fraction: number) => void = () => {}) {
  const form = new FormData();
  if (input.title) form.set('title', input.title);
  if (input.kind) form.set('kind', input.kind);
  form.set('consent_confirmed', String(input.consent_confirmed));
  if (input.file) form.set('file', input.file);
  if (input.text) form.set('text', input.text);
  return uploadWithProgress<Accepted>('/api/sources', form, onProgress);
}

export function useSourceActions(id: string) {
  const invalidate = useInvalidateSource();
  const onSuccess = () => invalidate(id);
  return {
    setSpeaker: useMutation({
      mutationFn: (creator_speaker: string) => unwrap(api.sources[':id']['speaker-map'].$post({ param: { id }, json: { creator_speaker } })),
      onSuccess,
    }),
    pasteTranscript: useMutation({
      mutationFn: (text: string) => unwrap(api.sources[':id'].transcript.$post({ param: { id }, json: { text } })),
      onSuccess,
    }),
    retry: useMutation({
      mutationFn: () => unwrap(api.sources[':id'].retry.$post({ param: { id } })),
      onSuccess,
    }),
    retireClaim: useMutation({
      mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) => unwrap(api.claims[':id'].retire.$post({ param: { id: claimId }, json: { reason } })),
      onSuccess,
    }),
  };
}

export { useInvalidateSource };
