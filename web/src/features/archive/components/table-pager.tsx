import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Paged } from '../use-paged';

/** "Showing 1 to 25 of 41" with previous and next page buttons. Hidden when everything fits on one page. */
export function TablePager({ paged, noun }: { paged: Paged; noun: string }) {
  if (paged.pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span className="tabular-nums">
        Showing {paged.start + 1} to {paged.end} of {paged.total} {noun}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="size-8" aria-label="Previous page" disabled={paged.page === 0} onClick={() => paged.setPage(paged.page - 1)}>
          <ChevronLeftIcon />
        </Button>
        <span className="tabular-nums">
          Page {paged.page + 1} of {paged.pages}
        </span>
        <Button variant="outline" size="icon" className="size-8" aria-label="Next page" disabled={paged.page >= paged.pages - 1} onClick={() => paged.setPage(paged.page + 1)}>
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
