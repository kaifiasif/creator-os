import { useMutation, useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/api/client';
import { queryKeys } from '@/api/query-client';
import { downloadCsv } from './download-csv';

export function useAcceptance() {
  return useQuery({ queryKey: queryKeys.acceptance, queryFn: () => unwrap(api.metrics.acceptance.$get()) });
}

export function useDrift(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.drift, queryFn: () => unwrap(api.metrics.drift.$get()), enabled });
}

/** The CSV is a file download, so it is fetched by URL rather than through the JSON client. */
export const EXPORT_CSV_URL = '/api/metrics/export.csv';

/** Saves every decided run as a CSV. */
export function useExportCsv() {
  return useMutation({ mutationFn: () => downloadCsv(EXPORT_CSV_URL, 'creator-os-decisions.csv') });
}
