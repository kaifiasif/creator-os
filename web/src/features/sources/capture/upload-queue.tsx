import { UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { plural } from '@/lib/format';
import { useSources } from '../api';
import { canUpload } from './queue-item';
import { UploadRow } from './upload-row';
import type { UploadQueue as Queue } from './use-upload-queue';

export function UploadQueue({ queue }: { queue: Queue }) {
  const sources = useSources();
  const statusOf = (id: string | null) => sources.data?.find((s) => s.id === id)?.status;
  const ready = queue.items.filter(canUpload).length;
  const finished = queue.items.some((item) => item.phase === 'added' || item.problem);
  if (!queue.items.length) return null;

  return (
    <section aria-label="Upload queue" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {plural(queue.items.length, 'file')}, {ready} ready to upload
        </p>
        <div className="flex items-center gap-2">
          {finished && (
            <Button variant="ghost" size="sm" onClick={queue.clearFinished}>
              Clear finished
            </Button>
          )}
          {ready > 1 && (
            <Button size="sm" onClick={() => void queue.uploadAll()}>
              <UploadIcon /> Upload all {ready}
            </Button>
          )}
        </div>
      </div>
      <ul className="grid gap-2">
        {queue.items.map((item) => (
          <UploadRow
            key={item.key}
            item={item}
            status={statusOf(item.sourceId)}
            onChange={(patch) => queue.update(item.key, patch)}
            onUpload={() => void queue.upload(item)}
            onCancel={() => queue.cancel(item.key)}
            onRemove={() => queue.remove(item.key)}
          />
        ))}
      </ul>
    </section>
  );
}
