import { useState } from 'react';

/** Slices a list into pages. The page index is clamped, so shrinking the list never strands the view. */
export function usePaged<T>(items: T[], pageSize: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages - 1);
  const start = current * pageSize;
  return { page: current, pages, start, end: Math.min(start + pageSize, items.length), total: items.length, slice: items.slice(start, start + pageSize), setPage };
}
export type Paged = ReturnType<typeof usePaged>;
