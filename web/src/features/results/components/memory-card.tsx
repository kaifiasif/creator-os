import type { AcceptanceOpen } from '@/api/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatPercent } from '@/lib/format';
import { rateFootnote } from '../format-rate';
import type { RateStat } from '../types';

function MemoryRow({ label, stat }: { label: string; stat: RateStat }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="font-semibold tabular-nums">{formatPercent(stat.rate)}</span>
      </div>
      <Progress value={(stat.rate ?? 0) * 100} aria-label={`${label}: ${formatPercent(stat.rate)}`} />
      <p className="text-xs text-muted-foreground">{rateFootnote({ ...stat, k: stat.light_edit })}</p>
    </div>
  );
}

export function MemoryCard({ byMemory }: { byMemory: AcceptanceOpen['by_memory'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Memory on and off</CardTitle>
        <CardDescription>Light-edit rate when drafts could see your past decisions, and when they could not.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <MemoryRow label="Memory on" stat={byMemory.on} />
        <MemoryRow label="Memory off" stat={byMemory.off} />
      </CardContent>
    </Card>
  );
}
