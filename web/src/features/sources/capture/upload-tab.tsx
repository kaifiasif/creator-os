import { toast } from 'sonner';
import { plural } from '@/lib/format';
import { Dropzone } from './dropzone';
import { ACCEPT } from './intake-rules';
import { UploadQueue } from './upload-queue';
import type { UploadQueue as Queue } from './use-upload-queue';

export function UploadTab({ queue }: { queue: Queue }) {
  const addFiles = async (files: File[]) => {
    const added = await queue.add(files);
    const rejected = added.filter((item) => item.problem).length;
    if (rejected) toast.error(`${plural(rejected, 'file')} cannot be added`, { description: 'The row says why.' });
  };

  return (
    <>
      <Dropzone
        accept={ACCEPT}
        onFiles={(files) => void addFiles(files)}
        compact={queue.items.length > 0}
        title={queue.items.length ? 'Add more files' : 'Drop voice memos, call recordings or transcripts'}
        hint="Audio up to 200 MB, text up to 100 KB. Choose several at once."
      />
      <UploadQueue queue={queue} />
    </>
  );
}
