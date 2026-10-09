import { AlertTriangleIcon, CheckCircle2Icon } from 'lucide-react';
import type { ArchiveImportResult } from '@/api/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { plural } from '@/lib/format';

export function ImportResultStep({ result }: { result: ArchiveImportResult }) {
  const details = [
    result.skipped_existing > 0 && `${plural(result.skipped_existing, 'post was', 'posts were')} already in your archive and skipped.`,
    result.holdout > 0 && `${plural(result.holdout, 'post is', 'posts are')} held out for testing.`,
    `Your archive now has ${plural(result.total_pieces, 'published piece')}.`,
  ].filter(Boolean);

  return (
    <div className="grid gap-3">
      <Alert>
        <CheckCircle2Icon />
        <AlertTitle>Imported {plural(result.imported, 'post')}</AlertTitle>
        <AlertDescription>
          {details.map((line) => (
            <p key={String(line)}>{line}</p>
          ))}
        </AlertDescription>
      </Alert>
      {result.warning && (
        <Alert>
          <AlertTriangleIcon />
          <AlertTitle>Below the prerequisite</AlertTitle>
          <AlertDescription>{result.warning}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
