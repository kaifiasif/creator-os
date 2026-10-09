import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { ArchiveImportResult, ArchivePreview } from '@/api/types';
import { plural } from '@/lib/format';
import { useArchiveActions, useArchivePreview } from './api';
import type { ImportFormat } from './types';

const MAX_BYTES = 25_000_000;
export type ImportStep = 'source' | 'preview' | 'done';

const newIds = (preview: ArchivePreview) => new Set(preview.rows.filter((r) => r.status === 'new').map((r) => r.external_id));

/** Choose a source, preview every row, tick what goes in, import. Nothing is saved before the last step. */
export function useImportFlow() {
  const previewMutation = useArchivePreview();
  const { importArchive } = useArchiveActions();

  const [step, setStep] = useState<ImportStep>('source');
  const [format, setFormat] = useState<ImportFormat>('x_export');
  const [file, setFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState('');
  const [includeReplies, setIncludeReplies] = useState(false);
  const [raw, setRaw] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ArchiveImportResult | null>(null);

  const hasInput = format === 'paste' ? pasted.trim().length > 0 : file !== null;

  const runPreview = async (replies = includeReplies) => {
    let text = raw;
    if (step === 'source') {
      if (format !== 'paste' && file && file.size > MAX_BYTES) {
        toast.error('That file is over 25 MB. Upload tweets.js on its own, not the whole archive zip.');
        return;
      }
      text = format === 'paste' ? pasted : ((await file?.text()) ?? '');
    }
    previewMutation.mutate(
      { format, raw: text, include_replies: replies },
      {
        onSuccess: (data) => {
          setRaw(text);
          setSelected(newIds(data));
          setStep('preview');
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const changeReplies = (value: boolean) => {
    setIncludeReplies(value);
    if (step === 'preview') void runPreview(value);
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const runImport = () =>
    importArchive.mutate(
      { format, raw, include_replies: includeReplies, only: [...selected] },
      {
        onSuccess: (data) => {
          setResult(data);
          setStep('done');
          toast.success(`Imported ${plural(data.imported, 'post')}.`);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );

  const reset = () => {
    setStep('source');
    setFile(null);
    setPasted('');
    setRaw('');
    setSelected(new Set());
    setResult(null);
    previewMutation.reset();
  };

  return {
    step,
    format,
    setFormat: (next: ImportFormat) => {
      setFormat(next);
      setFile(null);
    },
    file,
    setFile,
    pasted,
    setPasted,
    includeReplies,
    changeReplies,
    hasInput,
    preview: previewMutation.data ?? null,
    previewing: previewMutation.isPending,
    selected,
    toggle,
    setMany,
    importing: importArchive.isPending,
    result,
    runPreview,
    runImport,
    back: () => setStep('source'),
    reset,
  };
}
export type ImportFlow = ReturnType<typeof useImportFlow>;
