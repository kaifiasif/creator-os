import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { queryKeys } from '@/api/query-client';
import type { ArchiveImportInput } from '@/api/types';

export function useArchive() {
  return useQuery({ queryKey: queryKeys.archive, queryFn: () => unwrap(api.archive.$get()) });
}

export function useArchivePreview() {
  return useMutation({ mutationFn: (input: ArchiveImportInput) => unwrap(api.archive.preview.$post({ json: input })) });
}

export function useArchiveActions() {
  const client = useQueryClient();
  const onSuccess = () => {
    void client.invalidateQueries({ queryKey: queryKeys.archive });
    void client.invalidateQueries({ queryKey: queryKeys.calibration });
  };
  return {
    importArchive: useMutation({ mutationFn: (input: ArchiveImportInput) => unwrap(api.archive.import.$post({ json: input })), onSuccess }),
    retire: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => unwrap(api.archive[':id'].retire.$post({ param: { id }, json: { reason } })),
      onSuccess,
    }),
    unretire: useMutation({ mutationFn: (id: string) => unwrap(api.archive[':id'].retire.$delete({ param: { id } })), onSuccess }),
  };
}

export function useCalibration(enabled = true) {
  return useQuery({ queryKey: queryKeys.calibration, queryFn: () => unwrap(api.calibration.pairs.$get()), enabled });
}

export function useCalibrationActions() {
  const client = useQueryClient();
  const onSuccess = () => void client.invalidateQueries({ queryKey: queryKeys.calibration });
  return {
    saveLabels: useMutation({
      mutationFn: (labels: { piece_a: string; piece_b: string; same_angle: boolean }[]) => unwrap(api.calibration.labels.$post({ json: { labels } })),
      onSuccess,
    }),
    fit: useMutation({ mutationFn: () => unwrap(api.calibration.fit.$post()), onSuccess }),
  };
}
