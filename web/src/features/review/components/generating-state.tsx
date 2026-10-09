import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

/** A typical draft and its checks take about this long; the bar never claims to be done. */
const TYPICAL_MS = 20_000;

function useElapsed(since: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, now - Date.parse(since));
}

export function GeneratingState({ createdAt }: { createdAt: string }) {
  const elapsed = useElapsed(createdAt);
  return (
    <Card className="mx-auto w-full max-w-2xl shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Spinner /> Writing your draft
        </CardTitle>
        <CardDescription>Drafting from your claims, then checking every sentence against the source and your archive. This page updates on its own.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Progress value={Math.min(90, (elapsed / TYPICAL_MS) * 100)} aria-label="Drafting progress" />
        <div className="grid gap-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  );
}
