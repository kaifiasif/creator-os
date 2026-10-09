import { MicIcon, PauseIcon, PlayIcon, SquareIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { formatClock } from '@/lib/format';
import { LevelMeter } from './level-meter';
import { useRecorder } from './use-recorder';

const HINT = {
  idle: 'Talk it through like a walk memo. When you stop, the recording joins the upload queue so you can name it and send it.',
  starting: 'Waiting for microphone access.',
  recording: 'Recording. Stop when you are done.',
  paused: 'Paused. Resume, or stop to keep what you have.',
} as const;

export function Recorder({ onRecorded }: { onRecorded: (file: File) => void }) {
  const recorder = useRecorder(onRecorded);
  const live = recorder.state === 'recording' || recorder.state === 'paused';

  return (
    <div className="grid gap-4">
      <div className="flex flex-col items-center gap-4 rounded-lg border bg-card px-4 py-8 text-center">
        <LevelMeter levels={recorder.levels} active={recorder.state === 'recording'} />
        <p role="timer" aria-label="Recording length" className="text-3xl font-semibold tabular-nums">
          {formatClock(recorder.elapsedMs)}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {live ? (
            <>
              <Button variant="outline" onClick={recorder.togglePause}>
                {recorder.state === 'paused' ? <PlayIcon /> : <PauseIcon />}
                {recorder.state === 'paused' ? 'Resume' : 'Pause'}
              </Button>
              <Button onClick={recorder.stop}>
                <SquareIcon /> Stop and add to queue
              </Button>
            </>
          ) : (
            <Button onClick={() => void recorder.start()} disabled={recorder.state === 'starting'}>
              {recorder.state === 'starting' ? <Spinner /> : <MicIcon />} Start recording
            </Button>
          )}
        </div>
        <p className="max-w-sm text-sm text-muted-foreground">{HINT[recorder.state]}</p>
      </div>
      {recorder.error && (
        <Alert variant="destructive">
          <MicIcon />
          <AlertTitle>Recording could not start</AlertTitle>
          <AlertDescription>{recorder.error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
