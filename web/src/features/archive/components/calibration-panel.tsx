import { Undo2Icon } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { QueryView } from '@/components/shared/query-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useHotkey } from '@/hooks/use-hotkey';
import { plural } from '@/lib/format';
import { useCalibrationSession } from '../use-calibration-session';
import { CalibrationPair } from './calibration-pair';
import { CalibrationResult } from './calibration-result';

export function CalibrationPanel() {
  const session = useCalibrationSession();
  const { pair, position, total, unsaved, busy } = session;
  const cardRef = useRef<HTMLDivElement>(null);
  // Take focus from the tab that opened this panel, so the arrow keys label pairs instead of switching tabs.
  // Deferred: the browser focuses the clicked tab after the panel has already mounted.
  useEffect(() => {
    const timer = setTimeout(() => cardRef.current?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(timer);
  }, []);
  // Arrow keys another control already handled (tabs, menus) are not labels.
  useHotkey('ArrowRight', (e) => !e.defaultPrevented && session.label(true), { enabled: Boolean(pair) });
  useHotkey('ArrowLeft', (e) => !e.defaultPrevented && session.label(false), { enabled: Boolean(pair) });

  return (
    <Card ref={cardRef} tabIndex={-1} aria-label="Tune the repeat check" className="outline-none">
      <CardHeader>
        <CardTitle>Tune the repeat check</CardTitle>
        <CardDescription>Your labels tune when a new sentence counts as a repeat of something you already posted.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <QueryView query={session.query} loading={<Skeleton className="h-48" />}>
          {() =>
            pair ? (
              <>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">Do these two posts make the same point?</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      Pair {position + 1} of {total}
                    </span>
                  </div>
                  <Progress value={(position / total) * 100} aria-label={`${position} of ${total} pairs labelled`} />
                </div>
                <CalibrationPair pair={pair} />
                <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-center">
                  <Button variant="outline" onClick={() => session.label(false)} disabled={busy}>
                    Different
                  </Button>
                  <Button variant="outline" onClick={() => session.label(true)} disabled={busy}>
                    Same angle
                  </Button>
                </div>
                <p className="hidden text-center text-xs text-muted-foreground sm:block">
                  Press <Kbd>←</Kbd> for different or <Kbd>→</Kbd> for same angle.
                </p>
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {total ? 'Every pair in this round is labelled. Fit the threshold to use your labels.' : 'No pairs left to label. Import more posts to get new pairs.'}
              </p>
            )
          }
        </QueryView>
        <CalibrationResult fitted={session.fitted} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {plural(session.labelledBefore + unsaved, 'pair')} labelled{unsaved > 0 && `, ${unsaved} not saved yet`}
          </span>
          {unsaved > 0 && (
            <Button variant="ghost" size="sm" onClick={session.undo} disabled={busy}>
              <Undo2Icon /> Undo
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void session.save()} disabled={!unsaved || busy}>
            Save labels
          </Button>
          <Button onClick={() => void session.fitThreshold()} disabled={busy}>
            {busy && <Spinner />} Fit threshold
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
