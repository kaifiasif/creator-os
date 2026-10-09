import type { RunView } from '@/api/types';
import { PageHeader } from '@/components/shared/page';
import { StatusBadge } from '@/components/shared/status-badge';
import { Badge } from '@/components/ui/badge';
import { formatRelative, plural } from '@/lib/format';
import { RUN_STATUS } from '@/lib/labels';
import { DRAFT_FORMAT } from '@/lib/labels';

export function ReviewHeader({ run }: { run: RunView }) {
  const posts = run.draft?.posts.length ?? 0;
  const status = run.draft?.posted_at ? { label: 'Posted', tone: 'supported' as const } : RUN_STATUS[run.status];
  return (
    <div className="grid gap-2">
      <PageHeader title={run.source?.title ?? 'Draft'} />
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusBadge status={status} />
        <Badge variant="outline" className="text-muted-foreground">
          {run.format === 'thread' && posts ? `Thread of ${plural(posts, 'post')}` : DRAFT_FORMAT[run.format]}
        </Badge>
        <span>Drafted {formatRelative(run.created_at)}</span>
      </div>
    </div>
  );
}
