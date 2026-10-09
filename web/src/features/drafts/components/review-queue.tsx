import { FileTextIcon } from 'lucide-react';
import type { RunList } from '@/api/types';
import { navigate } from '@/app/router';
import { CardStack } from '@/components/shared/motion/card-stack';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatRelative } from '@/lib/format';
import { FORMAT, RUN_STATUS } from '@/lib/labels';

/** Drafts waiting for a decision, as a pile to flick through: drag the top one aside, or open it. */
export function ReviewQueue({ runs }: { runs: RunList }) {
  if (runs.length === 0) return null;
  const items = runs.map((run) => ({
    id: run.id,
    label: run.source_title,
    onOpen: () => navigate({ name: 'review', id: run.id }),
    content: (
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileTextIcon className="size-4" />
          </span>
          <StatusBadge status={RUN_STATUS[run.status]} />
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight">{run.source_title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {FORMAT[run.format]}, written {formatRelative(run.created_at)}
          </p>
        </div>
      </div>
    ),
  }));
  return (
    <section aria-label="Waiting for your decision" className="grid items-center gap-6 rounded-xl border bg-muted/40 p-5 @3xl/main:grid-cols-[minmax(0,22rem)_1fr]">
      <CardStack items={items} mode="flick" />
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          {runs.length === 1 ? 'One draft is waiting for you' : `${runs.length} drafts are waiting for you`}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Drag the top card aside to see the next one, or open it to check every sentence and decide. The numbers on Results unlock once each has a decision.
        </p>
      </div>
    </section>
  );
}
