import { UploadIcon } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { cn } from '@/lib/utils';

/** A drop target that is also a button, so keyboard users can open the file picker. */
export function Dropzone({ accept, onFiles, title, hint, compact = false }: { accept: string; onFiles: (files: File[]) => void; title: string; hint: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  const take = (list: FileList | null) => {
    if (list?.length) onFiles(Array.from(list));
  };
  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  };
  const onDragLeave = () => {
    depth.current = Math.max(0, depth.current - 1);
    if (!depth.current) setOver(false);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    take(e.dataTransfer.files);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          over ? 'border-primary bg-accent' : 'hover:bg-accent/50',
          compact ? 'px-4 py-5' : 'px-6 py-12',
        )}
      >
        <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
          <UploadIcon className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-medium">{over ? 'Drop to add' : title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}
