import { FileAudioIcon, FileTextIcon, FileWarningIcon, UploadIcon, XIcon } from 'lucide-react';
import type { SourceStatus } from '@/api/types';
import { hrefOf } from '@/app/router';
import { closeOverlay } from '@/app/ui-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/format';
import { SOURCE_STATUS } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { AddError } from './add-error';
import { AudioPreview } from './audio-preview';
import { needsConsent } from './intake-rules';
import { ConsentField, KindSelect } from './kind-fields';
import { canUpload, isEditable, type QueueItem } from './queue-item';
import { TextPeek } from './text-peek';

interface UploadRowProps {
  item: QueueItem;
  /** The source's live status once it has been added. */
  status: SourceStatus | undefined;
  onChange: (patch: Partial<QueueItem>) => void;
  onUpload: () => void;
  onCancel: () => void;
  onRemove: () => void;
}

export function UploadRow({ item, status, onChange, onUpload, onCancel, onRemove }: UploadRowProps) {
  const editable = isEditable(item) && !item.problem;
  const Icon = item.problem ? FileWarningIcon : item.medium === 'audio' ? FileAudioIcon : FileTextIcon;
  const id = (field: string) => `${item.key}-${field}`;

  return (
    <li className={cn('grid gap-3 rounded-lg border bg-card p-3 sm:p-4', item.problem && 'border-destructive/40')}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          {editable ? (
            <Input id={id('title')} aria-label={`Title for ${item.file.name}`} value={item.title} maxLength={200} onChange={(e) => onChange({ title: e.target.value })} className="h-8 font-medium" />
          ) : (
            <p className="truncate pt-1 text-sm font-medium">{item.title}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">
            {item.file.name}, {formatBytes(item.file.size)}
          </p>
        </div>
        {item.phase === 'uploading' ? (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : (
          item.phase !== 'added' && (
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${item.title || item.file.name}`} onClick={onRemove}>
              <XIcon />
            </Button>
          )
        )}
      </div>

      {item.problem && <AddError error={new Error(item.problem)} />}
      {!item.problem && item.medium === 'audio' && item.phase !== 'added' && <AudioPreview file={item.file} label={item.title} />}
      {!item.problem && item.sniff && item.phase !== 'added' && <TextPeek sniff={item.sniff} />}

      {editable && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <KindSelect id={id('kind')} value={item.kind} onChange={(kind) => onChange({ kind })} />
            <Button size="sm" className="ml-auto" disabled={!canUpload(item)} onClick={onUpload}>
              <UploadIcon /> {item.phase === 'failed' ? 'Try again' : 'Upload'}
            </Button>
          </div>
          {needsConsent(item.kind) && <ConsentField id={id('consent')} checked={item.consent} onChange={(consent) => onChange({ consent })} />}
        </div>
      )}

      {item.phase === 'uploading' && (
        <div className="flex items-center gap-3">
          <Progress value={item.progress * 100} aria-label={`Uploading ${item.title}`} className="flex-1" />
          <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round(item.progress * 100)}%</span>
        </div>
      )}

      {item.phase === 'failed' && <AddError error={item.error} />}

      {item.phase === 'added' && item.sourceId && (
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={SOURCE_STATUS[status ?? 'transcribing']} />
          <Button asChild variant="outline" size="sm" className="ml-auto">
            <a href={hrefOf({ name: 'source', id: item.sourceId })} onClick={closeOverlay}>
              Open source
            </a>
          </Button>
        </div>
      )}
    </li>
  );
}
