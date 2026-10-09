import { useRef, useState } from 'react';
import { createSourceRequest } from '../api';
import { canUpload, toQueueItem, type QueueItem } from './queue-item';
import { useSourceAdded } from './use-source-added';

export type UploadQueue = ReturnType<typeof useUploadQueue>;

/**
 * The capture sheet's upload queue. It lives above the sheet's content, so closing the sheet
 * mid-upload keeps the queue and its progress.
 */
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const aborts = useRef(new Map<string, () => void>());
  const cancelled = useRef(new Set<string>());
  const sourceAdded = useSourceAdded();

  const update = (key: string, patch: Partial<QueueItem>) => setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  const add = async (files: File[], title?: string) => {
    const next = await Promise.all(files.map((file) => toQueueItem(file, title)));
    setItems((list) => [...list, ...next]);
    return next;
  };

  /** Sends one item; resolves to the new source id, or null when it failed or was cancelled. */
  const send = async (item: QueueItem): Promise<string | null> => {
    if (!canUpload(item)) return null;
    update(item.key, { phase: 'uploading', progress: 0, error: null });
    const request = createSourceRequest(
      { title: item.title.trim() || undefined, kind: item.kind, consent_confirmed: item.consent, file: item.file },
      (progress) => update(item.key, { progress }),
    );
    aborts.current.set(item.key, request.abort);
    try {
      const { source_item_id } = await request.promise;
      update(item.key, { phase: 'added', progress: 1, sourceId: source_item_id });
      return source_item_id;
    } catch (error) {
      if (cancelled.current.delete(item.key)) update(item.key, { phase: 'waiting', progress: 0 });
      else update(item.key, { phase: 'failed', progress: 0, error });
      return null;
    } finally {
      aborts.current.delete(item.key);
    }
  };

  const upload = async (item: QueueItem) => {
    const id = await send(item);
    if (id) sourceAdded([id]);
  };

  const uploadAll = async () => {
    const ids: string[] = [];
    for (const item of items.filter(canUpload)) {
      const id = await send(item);
      if (id) ids.push(id);
    }
    sourceAdded(ids);
  };

  const cancel = (key: string) => {
    cancelled.current.add(key);
    aborts.current.get(key)?.();
  };

  return {
    items,
    add,
    update,
    upload,
    uploadAll,
    cancel,
    remove: (key: string) => setItems((list) => list.filter((item) => item.key !== key)),
    clearFinished: () => setItems((list) => list.filter((item) => item.phase !== 'added' && !item.problem)),
  };
}
