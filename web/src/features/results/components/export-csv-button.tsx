import { DownloadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useExportCsv } from '../api';

export function ExportCsvButton() {
  const exportCsv = useExportCsv();
  return (
    <Button variant="outline" size="sm" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}>
      {exportCsv.isPending ? <Spinner /> : <DownloadIcon />} Export CSV
    </Button>
  );
}
